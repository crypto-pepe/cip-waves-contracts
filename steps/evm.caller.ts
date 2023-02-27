import { Account, Contract, invoke } from '@pepe-team/waves-sc-test-utils';
import { prepareInvokeTx, sendTransaction, setTxSign } from './common';
import { getEnvironment } from 'relax-env-json';
const env = getEnvironment();

let contract: Contract;

export const setContract = (contract_: Contract) => {
  contract = contract_;
};

export const setMultisig = async (
  multisig_: string,
  contract_: Contract = contract
) => {
  const tx = prepareInvokeTx(
    {
      dApp: contract_.dApp,
      call: {
        function: 'setMultisig',
        args: [{ type: 'string', value: multisig_ }],
      },
    },
    { privateKey: contract_.privateKey }
  );
  await setTxSign(contract_.dApp, tx.id);
  await sendTransaction(tx);
};

export const init = async (
  pauser_: string,
  chainId_: any,
  contract_: Contract = contract
) => {
  const tx = prepareInvokeTx(
    {
      dApp: contract_.dApp,
      call: {
        function: 'init',
        args: [
          { type: 'string', value: pauser_ },
          { type: 'integer', value: chainId_ },
        ],
      },
    },
    { privateKey: contract_.privateKey }
  );
  await setTxSign(contract_.dApp, tx.id);
  await sendTransaction(tx);
};

export const allow = async (
  allower_: string,
  contract_: Contract = contract
) => {
  const tx = prepareInvokeTx(
    {
      dApp: contract_.dApp,
      call: {
        function: 'allow',
        args: [{ type: 'string', value: allower_ }],
      },
    },
    { privateKey: contract_.privateKey }
  );
  await setTxSign(contract_.dApp, tx.id);
  await sendTransaction(tx);
};

export const disallow = async (
  allower_: string,
  contract_: Contract = contract
) => {
  const tx = prepareInvokeTx(
    {
      dApp: contract_.dApp,
      call: {
        function: 'disallow',
        args: [{ type: 'string', value: allower_ }],
      },
    },
    { privateKey: contract_.privateKey }
  );
  await setTxSign(contract_.dApp, tx.id);
  await sendTransaction(tx);
};

export const updatePauser = async (
  pauser_: string,
  contract_: Contract = contract
) => {
  const tx = prepareInvokeTx(
    {
      dApp: contract_.dApp,
      call: {
        function: 'updatePauser',
        args: [{ type: 'string', value: pauser_ }],
      },
    },
    { privateKey: contract_.privateKey }
  );
  await setTxSign(contract_.dApp, tx.id);
  await sendTransaction(tx);
};

export const pause = async (
  pauser_: Account,
  contract_: Contract = contract
) => {
  return await invoke(
    {
      dApp: contract_.dApp,
      call: {
        function: 'pause',
      },
    },
    pauser_.privateKey,
    env.network
  );
};

export const unpause = async (
  pauser_: Account,
  contract_: Contract = contract
) => {
  return await invoke(
    {
      dApp: contract_.dApp,
      call: {
        function: 'unpause',
      },
    },
    pauser_.privateKey,
    env.network
  );
};

export const call = async (
  executionChainId_: number,
  executionContract_: string,
  calldata_: string,
  sender_: Account | Contract = contract,
  contract_: Contract = contract
) => {
  const privateKey =
    typeof sender_.privateKey == 'string'
      ? { privateKey: sender_.privateKey }
      : sender_.privateKey;
  return await invoke(
    {
      dApp: contract_.dApp,
      call: {
        function: 'call',
        args: [
          { type: 'integer', value: executionChainId_ },
          { type: 'string', value: executionContract_ },
          { type: 'string', value: calldata_ },
        ],
      },
    },
    privateKey,
    env.network
  );
};

export const selfCall = async (
  executionChainId_: number,
  executionContract_: string,
  calldata_: string,
  contract_: Contract = contract
) => {
  const tx = prepareInvokeTx(
    {
      dApp: contract_.dApp,
      call: {
        function: 'call',
        args: [
          { type: 'integer', value: executionChainId_ },
          { type: 'string', value: executionContract_ },
          { type: 'string', value: calldata_ },
        ],
      },
    },
    { privateKey: contract_.privateKey }
  );
  await setTxSign(contract_.dApp, tx.id);
  await sendTransaction(tx);
};
