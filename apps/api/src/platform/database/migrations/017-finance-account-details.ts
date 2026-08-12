export const financeAccountDetailsMigration = {
  id: '017-finance-account-details',
  sql: `
    ALTER TABLE finance_accounts
      ADD COLUMN account_type text;

    UPDATE finance_accounts SET account_type=type;

    ALTER TABLE finance_accounts
      ALTER COLUMN account_type SET NOT NULL;

    ALTER TABLE finance_accounts
      ADD CONSTRAINT finance_accounts_account_type_check
      CHECK (account_type IN ('cash', 'alipay', 'wechat', 'bank', 'credit', 'digital-cny', 'other')),
      ADD COLUMN card_number text,
      ADD COLUMN phone text,
      ADD COLUMN credit_limit numeric(16,2),
      ADD CONSTRAINT finance_accounts_card_number_check
        CHECK (card_number IS NULL OR char_length(card_number) BETWEEN 1 AND 100),
      ADD CONSTRAINT finance_accounts_phone_check
        CHECK (phone IS NULL OR char_length(phone) BETWEEN 1 AND 50),
      ADD CONSTRAINT finance_accounts_credit_limit_check
        CHECK (credit_limit IS NULL OR credit_limit >= 0);
  `,
} as const;
