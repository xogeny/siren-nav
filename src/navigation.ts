import { NavState } from './state';
import { Cache } from './cache';
import { follow, Step, reduce, accept } from './steps';
import { Entity } from 'siren-types';
import { NavResponse } from './response';
import { performAction, getRequest } from './requests';

/**
 * The SirenNav class provides a collection of methods that allow for 
 * a high-level declarative based approach to API navigation.
 * 
 * @export
 * @class SirenNav
 */
export class SirenNav {
    /**
     * Create a new SirenNav instance for an API with an entry point 
     * specified by the argument.
     * 
     * @static
     * @param {string} url Initial URL
     * @param {string} base Base URL for API (all URIs will be anchored to this)
     * @returns
     * 
     * @memberOf SirenNav
     */
    static create(url: string, base: string, cache: Cache) {
        return new SirenNav(Promise.resolve(new NavState(url, base, {
            baseURL: base,
        }, cache.getOr(url))), [], cache);
    }

    /**
     * Creates an instance of SirenNav.  This constructor is private because 
     * it initializes lots of state that should be encapsulated (i.e., we 
     * don't generally want people mucking about with this stuff).  Instead, 
     * we use static functions to create instances.
     * 
     * @param {Promise<NavState>} start
     * @param {Step[]} steps
     * 
     * @memberOf SirenNav
     */
    private constructor(private start: Promise<NavState>, private steps: Step[], private cache: Cache) {
    }

    /**
     * Follow a given relation.  The optional second argument is used to indicate 
     * that the first match should be used in cases where multiple matches are 
     * available.  If the second argument is undefined or false, then anything but 
     * a single (exact) match will result in an error.
     * 
     * @param {string} rel
     * @param {boolean} [first]
     * @returns {SirenNav}
     * 
     * @memberOf SirenNav
     */
    follow(rel: string, first?: boolean): SirenNav {
        return this.do(follow(rel, first));
    }

    /**
     * Perform an action that expects a "hypermedia" payload as the input 
     * to the function.
     * 
     * @template P
     * @param {string} name
     * @param {Entity<P>} body
     * @returns {NavResponse}
     * 
     * @memberOf SirenNav
     */
    performHyperAction<P extends {}>(name: string, body: Entity<P>, debug?: boolean): NavResponse {
        return this.performAction(name, body, debug || false);
    }

    /**
     * Perform an action using an arbitrary type of input data.
     * 
     * @template P
     * @param {string} name
     * @param {P} body
     * @returns {NavResponse}
     * 
     * @memberOf SirenNav
     */
    performAction<P>(name: string, body: P, debug?: boolean): NavResponse {
        let state = reduce(this.start, this.steps, this.cache, debug || false);
        let resp = state.then((s) => performAction(name, body)(s, debug || false));
        return NavResponse.create(resp, this);
    }

    /**
     * Perform a navigation step.  This is mainly an internal method, but it 
     * is exposed as a public method as to allow the set of possible 
     * navigation steps to be extensible.  Any transformation satisfying 
     * the Step type can be incorporated into the navigation process.
     * 
     * @param {Step} step
     * @returns {SirenNav}
     * 
     * @memberOf SirenNav
     */
    do(step: Step): SirenNav {
        return new SirenNav(this.start, [...this.steps, step], this.cache);
    }

    /**
     * This method can be used to generate a new SirenNav instance that 
     * has already prenavigated a particular set of steps.  When a 
     * "normal" SirenNav instance is evaluated, all the steps in the 
     * navigation are repeated.  If the same navigation is repeated 
     * over and over, many HTTP requests can potentially be made.
     * If those requests are sure to always return the same result,
     * then these requests will cause delays and unnecessarily 
     * network requests.  The squash method performs all the 
     * specified steps of the navigation BUT uses the resulting 
     * state to create a new SirenNav instance that always starts
     * at the resulting state.  It therefore avoids repeating 
     * steps on each execution.  However, squashing a SirenNav 
     * is only appropriate if the preceding steps are sure to 
     * always return the same results.
     * 
     * @returns {SirenNav}
     * 
     * @memberOf SirenNav
     */
    sqaush(debug?: boolean): SirenNav {
        return new SirenNav(reduce(this.start, this.steps, this.cache, debug || false), [], this.cache);
    }

    /**
     * This tells the navigator to jump to a given URL.  This is 
     * different from creating a new navigator because it
     * retains any information about the root URI of the API 
     * and any configuration changes that have accumulated.
     * 
     * @param {string} url
     * @returns {SirenNav}
     * 
     * @memberOf SirenNav
     */
    goto(url: string): SirenNav {
        let newstate = new Promise(async (resolve, reject) => {
            let state = await this.start;
            resolve(new NavState(url, state.root, state.config, this.cache.getOr(url)));
        })
        return new SirenNav(newstate, [], this.cache);
    }

    /**
     * Add an entry to the Accept header.  This can be called multiple times and each
     * call will add an additional option.  As with the Accept header itself, order 
     * matters.
     */
    accept(ctype: string): SirenNav {
        return this.do(accept(ctype));
    }

    /**
     * This method returns the URL of the resource that is being pointed 
     * to at the end of the chain of navigation steps.
     * 
     * @returns
     * 
     * @memberOf SirenNav
     */
    getURL(debug?: boolean) {
        return reduce(this.start, this.steps, this.cache, debug || false).then((state) => state.cur);
    }

    /**
     * The get method returns a NavResponse the represents the value of 
     * the current resource.
     * 
     * @returns {NavResponse}
     * 
     * @memberOf SirenNav
     */
    get(debug?: boolean): NavResponse {
        let state = reduce(this.start, this.steps, this.cache, debug || false);
        let resp = state.then((s) => getRequest(s, debug || false));
        return NavResponse.create(resp, this);
    }
}