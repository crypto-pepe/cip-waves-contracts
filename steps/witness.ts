import { Account, Contract, invoke } from '@pepe-team/waves-sc-test-utils';
import { getEnvironment } from 'relax-env-json';
import { prepareInvokeTx, sendTransaction, setTxSign } from './common';
const env = getEnvironment();

let contract: Contract;

export const defaultAmt = 1366000000;

export const setContract = (contract_: Contract) => {
  contract = contract_;
};

export const init = async (
  proxySecDepoPerEvent_: any,
  rewardTokenAddress_: string,
  rewardAmount_: any,
  contract_: Contract = contract
) => {
  const tx = prepareInvokeTx(
    {
      dApp: contract_.dApp,
      call: {
        function: 'init',
        args: [
          { type: 'integer', value: proxySecDepoPerEvent_ },
          { type: 'string', value: rewardTokenAddress_ },
          { type: 'integer', value: rewardAmount_ },
        ],
      },
    },
    { privateKey: contract_.privateKey }
  );
  await setTxSign(contract_.dApp, tx.id);
  await sendTransaction(tx);
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

export const setActiveWitnesses = async (
  chainId_: any,
  witnessList_: any[],
  contract_: Contract = contract
) => {
  const tx = prepareInvokeTx(
    {
      dApp: contract_.dApp,
      call: {
        function: 'setActiveWitnesses',
        args: [
          { type: 'integer', value: chainId_ },
          { type: 'list', value: witnessList_ },
        ],
      },
    },
    { privateKey: contract_.privateKey }
  );
  await setTxSign(contract_.dApp, tx.id);
  await sendTransaction(tx);
};

export const addProxySecurityDeposit = async (
  recipient_: string,
  sender_: Account,
  payment_: any[] = [{ assetId: null, amount: defaultAmt }],
  contract_: Contract = contract
) => {
  return await invoke(
    {
      dApp: contract_.dApp,
      call: {
        function: 'addProxySecurityDeposit',
        args: [{ type: 'string', value: recipient_ }],
      },
      payment: payment_,
    },
    sender_.privateKey,
    env.network
  );
};

export const subProxySecurityDeposit = async (
  amount_: number,
  sender_: Account,
  contract_: Contract = contract
) => {
  return await invoke(
    {
      dApp: contract_.dApp,
      call: {
        function: 'subProxySecurityDeposit',
        args: [{ type: 'integer', value: amount_ }],
      },
    },
    sender_.privateKey,
    env.network
  );
};

export const submitWavesCallEvent = async (
  callerChainId_: number | string,
  executionChainId_: number | string,
  nonce_: number | string,
  caller_: string,
  executionContract_: string,
  functionName_: string,
  args_: any[] = [],
  txHash_: string,
  blockNumber_: number | string,
  sender_: Account,
  contract_: Contract = contract
) => {
  return await invoke(
    {
      dApp: contract_.dApp,
      call: {
        function: 'submitWavesCallEvent',
        args: [
          { type: 'integer', value: callerChainId_ },
          { type: 'integer', value: executionChainId_ },
          { type: 'integer', value: nonce_ },
          { type: 'string', value: caller_ },
          { type: 'string', value: executionContract_ },
          { type: 'string', value: functionName_ },
          { type: 'list', value: args_ },
          { type: 'string', value: txHash_ },
          { type: 'integer', value: blockNumber_ },
        ],
      },
    },
    sender_.privateKey,
    env.network
  );
};

export const publishWavesEventStatus = async (
  eventIdx_: number,
  status_: number,
  sender_: Account,
  contract_: Contract = contract
) => {
  return await invoke(
    {
      dApp: contract_.dApp,
      call: {
        function: 'publishWavesEventStatus',
        args: [
          { type: 'integer', value: eventIdx_ },
          { type: 'integer', value: status_ },
        ],
      },
    },
    sender_.privateKey,
    env.network
  );
};
