import "server-only";

import { appsyncRequest } from "@/lib/appsync/invoices";
import type {
  DeleteClientMutation,
  GetAccountQuery,
  GetMyMembershipQuery,
  ListClientsQuery,
  PutAccountInput,
  PutAccountMutation,
  PutBankAccountInput,
  PutBankAccountMutation,
  PutClientInput,
  PutClientMutation,
} from "@/lib/appsync/graphql.generated";

export type Account = NonNullable<GetAccountQuery["getAccount"]>;
export type Client = ListClientsQuery["listClients"]["items"][number];
export type Membership = GetMyMembershipQuery["getMyMembership"];

const GET_ACCOUNT_QUERY = /* GraphQL */ `
  query GetAccount {
    getAccount {
      accountId
      type
      displayName
      legalName
      taxId
      email
      phone
      address
    }
  }
`;

const PUT_ACCOUNT_MUTATION = /* GraphQL */ `
  mutation PutAccount($input: PutAccountInput!) {
    putAccount(input: $input) {
      accountId
      type
      displayName
      legalName
      taxId
      email
      phone
      address
    }
  }
`;

const LIST_CLIENTS_QUERY = /* GraphQL */ `
  query ListClients($limit: Int, $nextToken: String) {
    listClients(limit: $limit, nextToken: $nextToken) {
      items {
        accountId
        clientId
        name
        email
        phone
        address
        taxId
      }
      nextToken
    }
  }
`;

const PUT_CLIENT_MUTATION = /* GraphQL */ `
  mutation PutClient($input: PutClientInput!) {
    putClient(input: $input) {
      accountId
      clientId
      name
      email
      phone
      address
      taxId
    }
  }
`;

const DELETE_CLIENT_MUTATION = /* GraphQL */ `
  mutation DeleteClient($clientId: ID!) {
    deleteClient(clientId: $clientId)
  }
`;

const PUT_BANK_ACCOUNT_MUTATION = /* GraphQL */ `
  mutation PutBankAccount($input: PutBankAccountInput!) {
    putBankAccount(input: $input) {
      bankAccountId
    }
  }
`;

const GET_MY_MEMBERSHIP_QUERY = /* GraphQL */ `
  query GetMyMembership {
    getMyMembership {
      accountId
      userId
      role
      status
      createdAt
      updatedAt
    }
  }
`;

export async function getAccount() {
  const data = await appsyncRequest<GetAccountQuery>(GET_ACCOUNT_QUERY);
  return data.getAccount ?? null;
}

export async function saveAccount(input: PutAccountInput) {
  const data = await appsyncRequest<PutAccountMutation>(PUT_ACCOUNT_MUTATION, { input });
  return data.putAccount;
}

export async function listClients(limit = 100) {
  const clients: Client[] = [];
  let cursor: string | null = null;

  do {
    const data: ListClientsQuery = await appsyncRequest<ListClientsQuery>(LIST_CLIENTS_QUERY, {
      limit,
      nextToken: cursor,
    });
    clients.push(...data.listClients.items);
    cursor = data.listClients.nextToken ?? null;
  } while (cursor);

  return clients;
}

export async function saveClient(input: PutClientInput) {
  const data = await appsyncRequest<PutClientMutation>(PUT_CLIENT_MUTATION, { input });
  return data.putClient;
}

export async function removeClient(clientId: string) {
  const data = await appsyncRequest<DeleteClientMutation>(DELETE_CLIENT_MUTATION, { clientId });
  return data.deleteClient;
}

export async function saveBankAccount(input: PutBankAccountInput) {
  const data = await appsyncRequest<PutBankAccountMutation>(PUT_BANK_ACCOUNT_MUTATION, { input });
  return data.putBankAccount;
}

export async function getMyMembership() {
  const data = await appsyncRequest<GetMyMembershipQuery>(GET_MY_MEMBERSHIP_QUERY);
  return data.getMyMembership;
}
