import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum BallotState { OPEN = 0, CLOSED = 1 }

export type Witnesses<PS> = {
  localSk(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  castVote(context: __compactRuntime.CircuitContext<PS>,
           choice_0: bigint,
           salt_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  closeBallot(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, []>>;
  revealVote(context: __compactRuntime.CircuitContext<PS>,
             choice_0: bigint,
             salt_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  verifyVote(context: __compactRuntime.CircuitContext<PS>,
             choice_0: bigint,
             salt_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, boolean>>;
}

export type ProvableCircuits<PS> = {
  castVote(context: __compactRuntime.CircuitContext<PS>,
           choice_0: bigint,
           salt_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  closeBallot(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, []>>;
  revealVote(context: __compactRuntime.CircuitContext<PS>,
             choice_0: bigint,
             salt_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  verifyVote(context: __compactRuntime.CircuitContext<PS>,
             choice_0: bigint,
             salt_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, boolean>>;
}

export type PureCircuits = {
  commitmentOf(choice_0: bigint, salt_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  castVote(context: __compactRuntime.CircuitContext<PS>,
           choice_0: bigint,
           salt_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  closeBallot(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, []>>;
  revealVote(context: __compactRuntime.CircuitContext<PS>,
             choice_0: bigint,
             salt_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  verifyVote(context: __compactRuntime.CircuitContext<PS>,
             choice_0: bigint,
             salt_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, boolean>>;
  commitmentOf(context: __compactRuntime.CircuitContext<PS>,
               choice_0: bigint,
               salt_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
}

export type Ledger = {
  readonly organizer: Uint8Array;
  readonly state: BallotState;
  readonly optionCount: bigint;
  readonly votes0: bigint;
  readonly votes1: bigint;
  readonly votes2: bigint;
  readonly votes3: bigint;
  voters: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  ballots: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  revealed: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  readonly voteCount: bigint;
  readonly revealedCount: bigint;
}

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               options_0: bigint): Promise<__compactRuntime.ConstructorResult<PS>>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
export declare const expectedVk: Record<string, string>;
export declare const circuitSignatures: __compactRuntime.CircuitSignatures;
export declare const declaredInterfaces: __compactRuntime.DeclaredInterfaces;
