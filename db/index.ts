import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { infer as ZodInfer } from "zod";
import type * as Zod from "zod";

function loadZod(): typeof Zod {
  const packageCandidates = [
    path.resolve(process.cwd(), "package.json"),
    path.resolve(process.cwd(), "backend", "package.json"),
    path.resolve(__dirname, "..", "backend", "package.json"),
    path.resolve(__dirname, "..", "..", "..", "backend", "package.json"),
  ];
  for (const packagePath of packageCandidates) {
    if (!fs.existsSync(packagePath)) {
      continue;
    }

    try {
      return createRequire(packagePath)("zod") as typeof Zod;
    } catch {
      // Try the next deployment-layout candidate.
    }
  }

  throw new Error("Backend package was not found");
}

const { z } = loadZod();

/**
 * The database package owns the persisted vault model. The backend imports
 * these definitions instead of keeping a second copy of the data contract.
 */

export const EncryptedValueSchema = z.object({
  iv: z.string().min(1),
  authTag: z.string().min(1),
  ciphertext: z.string().min(1),
});

export type EncryptedValue = ZodInfer<typeof EncryptedValueSchema>;

export const ActivityLogEntrySchema = z.object({
  id: z.string().uuid(),
  type: z.string().min(1).max(100),
  entityType: z.enum(["vault", "card", "account", "import"]),
  entityLabel: z.string().max(200),
  createdAt: z.string().datetime({ offset: true }),
});
export type ActivityLogEntry = ZodInfer<typeof ActivityLogEntrySchema>;

export const CardSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  deletedAt: z.string().datetime({ offset: true }).nullable().default(null),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export type Card = ZodInfer<typeof CardSchema>;

const CustomFieldKeySchema = z.string().trim().min(1).max(50);
const CustomFieldPlainValueSchema = z.string().max(1_000);
const OptionalUsernameSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0
      ? undefined
      : value,
  z.string().trim().min(1).max(200).optional(),
);

/** A persisted custom field keeps secret values in the same encrypted format as passwords. */
export const CustomFieldSchema = z.discriminatedUnion("isSecret", [
  z.object({
    id: z.string().uuid(),
    key: CustomFieldKeySchema,
    value: CustomFieldPlainValueSchema,
    isSecret: z.literal(false),
  }),
  z.object({
    id: z.string().uuid(),
    key: CustomFieldKeySchema,
    value: EncryptedValueSchema,
    isSecret: z.literal(true),
  }),
]);

export type CustomField = ZodInfer<typeof CustomFieldSchema>;

export const CustomFieldRequestSchema = z
  .object({
    id: z.string().uuid().optional(),
    key: CustomFieldKeySchema,
    value: CustomFieldPlainValueSchema,
    isSecret: z.boolean().default(false),
  });

export type CustomFieldRequest = ZodInfer<typeof CustomFieldRequestSchema>;

export const LegacyCustomFieldRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(50),
    value: CustomFieldPlainValueSchema,
    secret: z.boolean().optional(),
    isSecret: z.boolean().optional(),
  })
  .transform(({ name, value, secret, isSecret }) => ({
    key: name,
    value,
    isSecret: secret ?? isSecret ?? false,
  }));

export const PasswordHistoryEntrySchema = z.object({
  password: EncryptedValueSchema,
  changedAt: z.string().datetime({ offset: true }),
});

export type PasswordHistoryEntry = ZodInfer<
  typeof PasswordHistoryEntrySchema
>;

export const AccountSchema = z.object({
  id: z.string().uuid(),
  cardId: z.string().uuid(),
  email: z.string().email(),
  username: OptionalUsernameSchema,
  websiteUrl: z.string().url().max(2_048).optional(),
  password: EncryptedValueSchema,
  notes: z.string().max(2_000).optional(),
  customFields: z.array(CustomFieldSchema).max(20).default([]),
  leakCheckCache: EncryptedValueSchema.optional(),
  history: z.array(PasswordHistoryEntrySchema),
  deletedAt: z.string().datetime({ offset: true }).nullable().default(null),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export type Account = ZodInfer<typeof AccountSchema>;

export const VaultSchema = z.object({
  version: z.literal(1),
  cards: z.array(CardSchema),
  accounts: z.array(AccountSchema),
  activityLog: z.array(ActivityLogEntrySchema).max(500).default([]),
});

export type Vault = ZodInfer<typeof VaultSchema>;

export const VaultMetadataSchema = z.object({
  salt: z.string().min(1),
  verificationHash: z.string().min(1),
});

export type VaultMetadata = ZodInfer<typeof VaultMetadataSchema>;

export const VaultFileSchema = z.object({
  version: z.literal(1),
  metadata: VaultMetadataSchema,
  encryptedVault: EncryptedValueSchema,
});

export type VaultFile = ZodInfer<typeof VaultFileSchema>;

export const SetupVaultRequestSchema = z.object({
  masterPassword: z.string().min(1),
});

export const UnlockVaultRequestSchema = z.object({
  masterPassword: z.string().min(1),
});

export const CreateCardRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export const RenameCardRequestSchema = CreateCardRequestSchema;

export const CreateAccountRequestSchema = z.object({
  email: z.string().email(),
  username: OptionalUsernameSchema,
  password: z.string().min(1),
  websiteUrl: z.string().url().max(2_048).optional(),
  notes: z.string().max(2_000).optional(),
  customFields: z.array(CustomFieldRequestSchema).max(20).default([]),
});

export const UpdateAccountRequestSchema = z
  .object({
    email: z.string().email().optional(),
    username: OptionalUsernameSchema,
    websiteUrl: z.string().url().max(2_048).nullable().optional(),
    notes: z.string().max(2_000).nullable().optional(),
  customFields: z.array(CustomFieldRequestSchema).max(20).optional(),
  })
  .refine(
    (value) =>
      value.email !== undefined ||
      value.username !== undefined ||
      value.websiteUrl !== undefined ||
      value.notes !== undefined ||
      value.customFields !== undefined,
    { message: "At least one account field is required" },
  );

export const ChangePasswordRequestSchema = z.object({
  newPassword: z.string().min(1),
});

export const PasswordGeneratorRequestSchema = z
  .object({
    length: z.number().int().min(1).max(512).default(18),
    uppercase: z.boolean().default(true),
    lowercase: z.boolean().default(true),
    numbers: z.boolean().default(true),
    symbols: z.boolean().default(true),
  })
  .superRefine((value, context) => {
    const enabledCount = [
      value.uppercase,
      value.lowercase,
      value.numbers,
      value.symbols,
    ].filter(Boolean).length;

    if (enabledCount === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one character category must be enabled",
        path: ["length"],
      });
    } else if (value.length < enabledCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Length must fit every enabled character category",
        path: ["length"],
      });
    }
  });

/**
 * Resolve the repository's real db directory from either the source tree,
 * the compiled tree, or a process started from the repository root/backend.
 * The first existing candidate wins; the fallback is the conventional
 * repository-root/db path from the backend working directory.
 */
function resolveDbDirectory(): string {
  const configuredDirectory = process.env.VVAULT_DB_DIRECTORY;
  if (configuredDirectory !== undefined && configuredDirectory.length > 0) {
    return path.resolve(configuredDirectory);
  }

  const candidates = [
    path.resolve(process.cwd(), "db"),
    path.resolve(process.cwd(), "..", "db"),
    path.resolve(__dirname),
    path.resolve(__dirname, "..", "..", "..", "db"),
  ];

  return (
    candidates.find((candidate) =>
      fs.existsSync(path.join(candidate, "index.ts")),
    ) ?? path.resolve(process.cwd(), "..", "db")
  );
}

export const DB_DIRECTORY = resolveDbDirectory();
export const VAULT_FILE_PATH = process.env.VVAULT_FILE_PATH
  ? path.resolve(process.env.VVAULT_FILE_PATH)
  : path.join(DB_DIRECTORY, "vault.vault");
