import { Identity } from '@clockworklabs/spacetimedb-sdk';
import { 
    DbConnection, 
    ErrorContext, 
    SubscriptionEventContext 
} from './module_bindings/index';

// --- SpacetimeDB Setup ---
const host = "192.168.1.11:3000"; // SpacetimeDB host
const dbName = "spacetime-pong"; // Database name used during publish

// Store the connection globally or pass it around
export let spacetimedbConnection: DbConnection | null = null;

// Define callback types for clarity
type OnConnectCallback = (connection: DbConnection, identity: Identity, token: string) => void;
type OnErrorCallback = (context: ErrorContext, error: Error) => void;
type OnDisconnectCallback = (context: ErrorContext, error?: Error | undefined) => void;
type OnSubscriptionAppliedCallback = (context: SubscriptionEventContext) => void;
type OnSubscriptionErrorCallback = (context: ErrorContext) => void;


interface ConnectOptions {
    onConnect: OnConnectCallback;
    onConnectError: OnErrorCallback;
    onDisconnect: OnDisconnectCallback;
    onSubscriptionApplied: OnSubscriptionAppliedCallback;
    onSubscriptionError: OnSubscriptionErrorCallback;
}

export function initializeSpacetimeDB(options: ConnectOptions) {
    console.log(`Connecting to SpacetimeDB at ${host}, database: ${dbName}...`);

    const builder = DbConnection.builder();

    builder
        .withUri(`ws://${host}`)
        .withModuleName(dbName)
        .withToken(localStorage.getItem("auth_token") || '') // Use auth_token consistently
        .onConnect((connection: DbConnection, identity: Identity, token: string) => {
            spacetimedbConnection = connection; // Store the connection globally
            options.onConnect(connection, identity, token); // Call the provided callback

            // Subscribe to all tables using the builder with callbacks
            connection.subscriptionBuilder()
                .onApplied(options.onSubscriptionApplied)
                .onError(options.onSubscriptionError)
                .subscribeToAllTables(); 
        })
        .onConnectError(options.onConnectError)
        .onDisconnect((context: ErrorContext, error?: Error | undefined) => {
             spacetimedbConnection = null; // Clear connection on disconnect
             options.onDisconnect(context, error); // Call the provided callback
        })
        .build();
}

// Function to get the current connection (useful if needed elsewhere)
export function getSpacetimeDBConnection(): DbConnection | null {
    return spacetimedbConnection;
}
