/**
 * Javascript generator persistence support.
 *
 * - Helps to maintain a property 'state' that is attached to the generator.
 * Only the value of this field needs to be persisted, in order to achieve JS
 * generator persistence.
 * - Allows the generator to fast-forward on load, to the persisted value of
 * state.numOfYieldsExecuted.
 *
 * How to use:
 * 1. Create the generator creation function using the function
 * generatorWithState(). The returned generator creation function will allow
 * for either 'input' to be passed to it as non-null (for the case of
 * non-persisted, fresh generator), or 'state' to be passed to it as non-null
 * (for the case of persisted generator). But 'input' and 'state' cannot be both
 * null, or both non-null.
 * The above function acts as a wrapper around a more naive function, that
 * always accepts both 'input' and 'state' as non-null parameters.
 *
 * 2. Replace uses of 'yield xyz' in the generator code with
 * 'yield* yieldIfNeeded(state, xyz)'.
 */

/**
 * Optional to call this. Currently does nothing except disable assertions that
 * may increase performance to a very small extent.
 * @param {boolean} enableAssertions
 */
export function configJsGenWithState(enableAssertions) {
  areAssertionsEnabled = enableAssertions;
}

/**
 * @typedef {Object} GenState The state of the generator.
 * @property {number} numOfYieldsExecuted The number of 'yield' statements
 * executed by the generator. Used to fast-forward the generator (i.e. execute
 * while skipping the 'yield' statements) to the last saved state, at the time
 * of loading the generator from persistent storage.
 * @property {any} input The input that was given to the function that created
 * the generator.
 * @property {number} [numOfYieldsToSkip] on load, this variable is set to the
 * saved value of numOfYieldsExecuted (unless numOfYieldsToSkip was also saved,
 * with a higher value than numOfYieldsExecuted). Then numOfYieldsExecuted can
 * be reset to 0 and then count up to numOfYieldsToSkip while doing
 * fast-forwarding, and thereafter yielding can take effect rather than being
 * skipped.
 *
 * @typedef {Object} ObjWithNonNullState
 * @property {GenState} state
 *
 * @typedef {Generator<any, void, unknown> & ObjWithState} GenWithState
 *
 * @typedef {Object} ObjWithState
 * @property {GenState} state
 *
 * @typedef {Generator<any, void, unknown> & ObjWithState} GeneratorWithState
 *
 * @typedef {(string|number|object|boolean|function)} AnyButNeitherNullNorUndefined
 */

/**
 * Returns a function to create a generator that can be persisted. The
 * generator is either created from a parameter named 'input' (in which case it
 * is supposed to not already be persisted on disk), or created using a
 * parameter 'state' (in which case it is assumed to be persisted on disk and
 * the 'state' parameter contains the persisted state).
 *
 * The 'input' and 'state' parameters cannot simultaneously be non-null or
 * simultaneously be null. When one of them is null, the other must be non-null.
 *
 * This is a wrapper around a basic generator that always assumes a non-null
 * state parameter, i.e. it assumes that the generator is loading/loaded.
 *
 * If state is non-null, the first parameter 'input' of the 2-parameter
 * generator function, is expected to be null. In this case, 'input' is
 * populated from the state. However for a brand new generator with null state,
 * the 'input' parameter is expected to be non-null, and is instead saved to the
 * new state.
 *
 * @param {(input: AnyButNeitherNullNorUndefined, state: GenState) =>
 * Generator<any,void,unknown>} generatorWithNonNullState
 *
 * @return {(input: any, state?: GenState|null) => GeneratorWithState}
 */
export function generatorWithState(generatorWithNonNullState) {
  return (
    /** @type {any} */ input,
    /** @type {GenState|null|undefined} */ state
  ) => {
    if (input != null) {
      //This is a brand new generator with null state, and not loaded from
      //persistence.
      areAssertionsEnabled && assert(state == null);
      state = { input, numOfYieldsExecuted: 0 };
    } else {
      //The input part is null.
      //This is the scenario where the generator needs to be reloaded from
      //the state.
      assert(state != null);
      //Confirm that state.input was saved. This is the input to the generator
      //given at the time it was created.
      const s = /** @type {GenState} */ (state);
      areAssertionsEnabled && assert(s.input != null);
      input = s.input;
    }
    const s = /** @type {GenState} */ (state);
    if (
      s.numOfYieldsToSkip == null ||
      s.numOfYieldsToSkip < s.numOfYieldsExecuted
    ) {
      s.numOfYieldsToSkip = s.numOfYieldsExecuted;
    }
    s.numOfYieldsExecuted = 0;
    const gen = /** @type {GeneratorWithState} */ (
      generatorWithNonNullState(input, s)
    );
    gen.state = s;
    return gen;
  };
}

/**
 * Replace each 'yield xyz' with 'yield* yieldIfNeeded(state, xyz)'.
 *
 * These replacements are needed so that numOfYieldsExecuted can be incremented
 * and then a decision can be taken to either yield or fast-forward.
 *
 * @param {GenState} state
 * @param {any} val
 */
export function* yieldIfNeeded(state, val) {
  state.numOfYieldsExecuted++;
  if (
    state.numOfYieldsToSkip == null ||
    state.numOfYieldsExecuted > state.numOfYieldsToSkip
  ) {
    yield val;
  }
}

/**
 * @param {boolean} x
 */
function assert(x) {
  if (!x) {
    debugger;
    throw new Error("assertion failed");
  }
}

let areAssertionsEnabled = true;
