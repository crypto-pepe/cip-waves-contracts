import { Account, Contract, invoke } from '@pepe-team/waves-sc-test-utils';
import { getEnvironment } from 'relax-env-json';
import { InvokeScriptCallStringArgument } from '@waves/ts-types/dist/src/parts';
import {
  getTechUser,
  prepareInvokeTx,
  sendTransaction,
  setTxSign,
} from './common';
const env = getEnvironment();

let contract: Contract;

export const setContract = (contract_: Contract) => {
  contract = contract_;
};

export const init = async (
  contract: Contract,
  owners: string[],
  quorum: number
) => {
  const ownersList: InvokeScriptCallStringArgument[] = owners.map((o) => {
    return { type: 'string', value: o };
  });
  await invoke(
    {
      dApp: contract.dApp,
      call: {
        function: 'init',
        args: [
          { type: 'list', value: ownersList },
          { type: 'integer', value: quorum },
        ],
      },
    },
    getTechUser().privateKey,
    env.network
  );
};

export const addOwner = async (
  publicKey_: string,
  contract_: Contract = contract
) => {
  const tx = prepareInvokeTx(
    {
      dApp: contract_.dApp,
      call: {
        function: 'addOwner',
        args: [{ type: 'string', value: publicKey_ }],
      },
    },
    { privateKey: contract_.privateKey }
  );
  await setTxSign(contract_.dApp, tx.id);
  await sendTransaction(tx);
};

export const removeOwner = async (
  publicKey_: string,
  contract_: Contract = contract
) => {
  const tx = prepareInvokeTx(
    {
      dApp: contract_.dApp,
      call: {
        function: 'removeOwner',
        args: [{ type: 'string', value: publicKey_ }],
      },
    },
    { privateKey: contract_.privateKey }
  );
  await setTxSign(contract_.dApp, tx.id);
  await sendTransaction(tx);
};

export const setQuorum = async (
  quorum_: number,
  contract_: Contract = contract
) => {
  const tx = prepareInvokeTx(
    {
      dApp: contract_.dApp,
      call: {
        function: 'setQuorum',
        args: [{ type: 'integer', value: quorum_ }],
      },
    },
    { privateKey: contract_.privateKey }
  );
  await setTxSign(contract_.dApp, tx.id);
  await sendTransaction(tx);
};

export const confirmTransaction = async (
  user: Account,
  dApp_: string,
  txid_: string,
  contract_: Contract = contract
) => {
  await invoke(
    {
      dApp: contract_.dApp,
      call: {
        function: 'confirmTransaction',
        args: [
          { type: 'string', value: dApp_ },
          { type: 'string', value: txid_ },
        ],
      },
    },
    user.privateKey,
    env.network
  );
};

export const revokeConfirmation = async (
  user: Account,
  dApp_: string,
  txid_: string,
  contract_: Contract = contract
) => {
  await invoke(
    {
      dApp: contract_.dApp,
      call: {
        function: 'revokeConfirmation',
        args: [
          { type: 'string', value: dApp_ },
          { type: 'string', value: txid_ },
        ],
      },
    },
    user.privateKey,
    env.network
  );
};
