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
import { Ball } from "./ball_type";
import { EventContext, Reducer, RemoteReducers, RemoteTables } from ".";

/**
 * Table handle for the table `ball`.
 *
 * Obtain a handle from the [`ball`] property on [`RemoteTables`],
 * like `ctx.db.ball`.
 *
 * Users are encouraged not to explicitly reference this type,
 * but to directly chain method calls,
 * like `ctx.db.ball.on_insert(...)`.
 */
export class BallTableHandle {
  tableCache: TableCache<Ball>;

  constructor(tableCache: TableCache<Ball>) {
    this.tableCache = tableCache;
  }

  count(): number {
    return this.tableCache.count();
  }

  iter(): Iterable<Ball> {
    return this.tableCache.iter();
  }
  /**
   * Access to the `singleton_id` unique index on the table `ball`,
   * which allows point queries on the field of the same name
   * via the [`BallSingletonIdUnique.find`] method.
   *
   * Users are encouraged not to explicitly reference this type,
   * but to directly chain method calls,
   * like `ctx.db.ball.singleton_id().find(...)`.
   *
   * Get a handle on the `singleton_id` unique index on the table `ball`.
   */
  singleton_id = {
    // Find the subscribed row whose `singleton_id` column value is equal to `col_val`,
    // if such a row is present in the client cache.
    find: (col_val: number): Ball | undefined => {
      for (let row of this.tableCache.iter()) {
        if (deepEqual(row.singleton_id, col_val)) {
          return row;
        }
      }
    },
  };

  onInsert = (cb: (ctx: EventContext, row: Ball) => void) => {
    return this.tableCache.onInsert(cb);
  }

  removeOnInsert = (cb: (ctx: EventContext, row: Ball) => void) => {
    return this.tableCache.removeOnInsert(cb);
  }

  onDelete = (cb: (ctx: EventContext, row: Ball) => void) => {
    return this.tableCache.onDelete(cb);
  }

  removeOnDelete = (cb: (ctx: EventContext, row: Ball) => void) => {
    return this.tableCache.removeOnDelete(cb);
  }

  // Updates are only defined for tables with primary keys.
  onUpdate = (cb: (ctx: EventContext, oldRow: Ball, newRow: Ball) => void) => {
    return this.tableCache.onUpdate(cb);
  }

  removeOnUpdate = (cb: (ctx: EventContext, onRow: Ball, newRow: Ball) => void) => {
    return this.tableCache.removeOnUpdate(cb);
  }}
