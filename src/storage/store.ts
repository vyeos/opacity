import type { DeliveryAttempt, EnrichedSignal, SourceKind } from "../shared/types.js";

export interface Store {
  init(): Promise<void>;
  close(): Promise<void>;
  hasSignal(signalId: string): Promise<boolean>;
  saveEnrichedSignal(signal: EnrichedSignal): Promise<void>;
  recordDeliveries(signalId: string, attempts: DeliveryAttempt[]): Promise<void>;
  getMutedSources(): Promise<SourceKind[]>;
  muteSource(source: SourceKind): Promise<void>;
  getSignalExplain(signalId: string): Promise<string | null>;
}
