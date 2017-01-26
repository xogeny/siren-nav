import { NavState } from './state';
import { getSelf } from './utils';
import { getSiren } from './utils';
import { Cache } from './cache';
import { Link } from 'siren-types';

export type Step = (cur: NavState, cache: Cache, debug: boolean) => Promise<NavState>;

export async function reduce(cur: Promise<NavState>, steps: Step[], cache: Cache, debug: boolean): Promise<NavState> {
    if (steps.length == 0) return cur;
    let state = await cur;
    return reduce(steps[0](state, cache, debug), steps.slice(1), cache, debug);
}

export function accept(ctype: string): Step {
    return async (state: NavState, cache: Cache, debug: boolean): Promise<NavState> => {
        if (debug) console.log("Fetching data accepting only '" + ctype + "' as content type");
        if (debug) console.log("  Resource: " + state.cur);
        let newconfig = { ...state.config };
        if (!newconfig.headers) newconfig.headers = {};

        if (newconfig.headers.hasOwnProperty("Accept")) {
            newconfig.headers["Accept"] += ", " + ctype
        } else {
            newconfig.headers["Accept"] = ctype;
        }
        return new NavState(state.cur, state.root, newconfig, cache.getOr(state.cur));
    }
}

export function follow(rel: string, first?: boolean): Step {
    return (state: NavState, cache: Cache, debug: boolean): Promise<NavState> => {
        return getSiren(state).then((siren) => {
            if (debug) console.log("Follow '" + rel + "':");
            let possible: NavState[] = [];
            (siren.entities || []).forEach((entity) => {
                if (entity.rel.indexOf(rel) == -1) return;
                if (entity.hasOwnProperty("href")) {
                    if (debug) console.log("  Found possible match in subentity link");
                    let href = entity["href"];
                    possible.push(new NavState(href, state.root, state.config, cache.getOr(href)));
                } else {
                    let self = getSelf(entity);
                    if (self) {
                        if (debug) console.log("  Found possible match in subentity resource");
                        possible.push(new NavState(self, state.root, entity, cache.getOr(self)));
                    }
                }
            });
            (siren.links || []).forEach((link: Link) => {
                if (link.rel.indexOf(rel) == -1) return;
                if (debug) console.log("  Found possible match among links");
                possible.push(new NavState(link.href, state.root, state.config, cache.getOr(link.href)));
            });
            if (possible.length == 0) {
                console.error("Cannot follow relation '" + rel + "', no links with that relation in ", siren);
                throw new Error("Cannot follow relation '" + rel + "', no links with that relation in " + JSON.stringify(siren, null, 4));
            }
            if (possible.length > 1 && !first) {
                console.error("Multiple links with relation '" + rel + "' found when only one was expected in ", siren);
                throw new Error("Multiple links with relation '" + rel + "' found when only one was expected in " + JSON.stringify(siren, null, 4));
            }
            if (debug) console.log("  Found match, resulting state: " + JSON.stringify(possible[0]));
            return possible[0];
        })
    }
}