import type {
  FinanceAccountInput,
  FinanceAccountUpdateInput,
  FinanceDebtPlatformInput,
  FinanceDebtPlatformUpdateInput,
  FinanceDebtRecordInput,
} from '@workspace/client-sdk';
import { queryClient, workbenchClient } from '../../platform/api/client.js';
export const financeKeys = {
  all: ['finance'] as const,
  summary: (year: number, month: number) => ['finance', 'summary', year, month] as const,
  accounts: (archived: boolean) => ['finance', 'accounts', archived] as const,
  platforms: (archived: boolean) => ['finance', 'platforms', archived] as const,
};
export async function invalidateFinanceData(): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: financeKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['workbench', 'overview'] }),
  ]);
}
export const financeApi = {
  summary(year: number, month: number) {
    return workbenchClient.getFinanceSummary(year, month);
  },
  accounts(archived = false) {
    return workbenchClient.getFinanceAccounts(archived);
  },
  createAccount(input: FinanceAccountInput) {
    return workbenchClient.createFinanceAccount(input);
  },
  updateAccount(id: string, input: FinanceAccountUpdateInput) {
    return workbenchClient.updateFinanceAccount(id, input);
  },
  archiveAccount(id: string, version: number) {
    return workbenchClient.archiveFinanceAccount(id, version);
  },
  restoreAccount(id: string, version: number) {
    return workbenchClient.restoreFinanceAccount(id, version);
  },
  deleteAccount(id: string, version: number) {
    return workbenchClient.deleteFinanceAccountPermanently(id, version);
  },
  platforms(archived = false) {
    return workbenchClient.getFinanceDebtPlatforms(archived);
  },
  createPlatform(input: FinanceDebtPlatformInput) {
    return workbenchClient.createFinanceDebtPlatform(input);
  },
  updatePlatform(id: string, input: FinanceDebtPlatformUpdateInput) {
    return workbenchClient.updateFinanceDebtPlatform(id, input);
  },
  archivePlatform(id: string, version: number) {
    return workbenchClient.archiveFinanceDebtPlatform(id, version);
  },
  restorePlatform(id: string, version: number) {
    return workbenchClient.restoreFinanceDebtPlatform(id, version);
  },
  deletePlatform(id: string, version: number) {
    return workbenchClient.deleteFinanceDebtPlatformPermanently(id, version);
  },
  upsertRecord(input: FinanceDebtRecordInput) {
    return workbenchClient.upsertFinanceDebtRecord(input);
  },
  deleteRecord(id: string, version: number) {
    return workbenchClient.deleteFinanceDebtRecord(id, version);
  },
};
