// THIS FILE IS AUTOMATICALLY GENERATED BY SPACETIMEDB. EDITS TO THIS FILE
// WILL NOT BE SAVED. MODIFY TABLES IN YOUR MODULE SOURCE CODE INSTEAD.

/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
import {
  AlgebraicType,
  AlgebraicValue,
  BinaryReader,
  BinaryWriter,
  CallReducerFlags,
  ConnectionId,
  DbConnectionBuilder,
  DbConnectionImpl,
  DbContext,
  ErrorContextInterface,
  Event,
  EventContextInterface,
  Identity,
  ProductType,
  ProductTypeElement,
  ReducerEventContextInterface,
  SubscriptionBuilderImpl,
  SubscriptionEventContextInterface,
  SumType,
  SumTypeVariant,
  TableCache,
  TimeDuration,
  Timestamp,
  deepEqual,
} from "@clockworklabs/spacetimedb-sdk";
// A namespace for generated variants and helper functions.
export namespace GameStatus {
  // These are the generated variant types for each variant of the tagged union.
  // One type is generated per variant and will be used in the `value` field of
  // the tagged union.
  export type Waiting = { tag: "Waiting" };
  export type Playing = { tag: "Playing" };
  export type Paused = { tag: "Paused" };
  export type Finished = { tag: "Finished" };

  // Helper functions for constructing each variant of the tagged union.
  // ```
  // const foo = Foo.A(42);
  // assert!(foo.tag === "A");
  // assert!(foo.value === 42);
  // ```
  export const Waiting = { tag: "Waiting" };
  export const Playing = { tag: "Playing" };
  export const Paused = { tag: "Paused" };
  export const Finished = { tag: "Finished" };

  export function getTypeScriptAlgebraicType(): AlgebraicType {
    return AlgebraicType.createSumType([
      new SumTypeVariant("Waiting", AlgebraicType.createProductType([])),
      new SumTypeVariant("Playing", AlgebraicType.createProductType([])),
      new SumTypeVariant("Paused", AlgebraicType.createProductType([])),
      new SumTypeVariant("Finished", AlgebraicType.createProductType([])),
    ]);
  }

  export function serialize(writer: BinaryWriter, value: GameStatus): void {
      GameStatus.getTypeScriptAlgebraicType().serialize(writer, value);
  }

  export function deserialize(reader: BinaryReader): GameStatus {
      return GameStatus.getTypeScriptAlgebraicType().deserialize(reader);
  }

}

// The tagged union or sum type for the algebraic type `GameStatus`.
export type GameStatus = GameStatus.Waiting | GameStatus.Playing | GameStatus.Paused | GameStatus.Finished;

export default GameStatus;

