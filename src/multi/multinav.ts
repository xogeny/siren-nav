import { NavState } from "../state";
import { MultiStep, toMulti, followEach } from "./multistep";
import { Step, reduceEach, follow } from "../steps";
import { MultiResponse } from "./multiresp";
import { getRequest } from "../requests";

/**
 * The MultiNav class is not one a user would generally instantiate themselves.
 * Instead, it is created in response to certain steps in a chain that cause the
 * set of resources to "fan out".  The main example of this is when you follow a
 * relation and there are multiple instances of that relation.
 *
 * @export
 * @class MultiNav
 */
export class MultiNav {
    constructor(private start: Promise<NavState[]>, private steps: MultiStep[], private omni: Step[]) {}
    get(): MultiResponse {
        let state = reduceEach(this.start, [...this.steps, ...this.omni.map(toMulti)]);
        let resp = state.then(s => Promise.all(s.map(x => getRequest(x))));
        return MultiResponse.create(resp);
    }
    do(step: Step): MultiNav {
        return new MultiNav(this.start, [...this.steps, toMulti(step)], this.omni);
    }
    doMulti(steps: MultiStep): MultiNav {
        return new MultiNav(this.start, [...this.steps, steps], this.omni);
    }

    follow(rel: string, parameters?: {}, which?: (states: NavState[]) => NavState): MultiNav {
        return this.do(follow(rel, parameters, which));
    }

    followEach(rel: string, parameters?: {}): MultiNav {
        return this.doMulti(followEach(rel, parameters));
    }
}
