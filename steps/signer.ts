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
  minSecDepo_: number | string,
  punishment_: number | string,
  resetBlockDelta_: number | string,
  rewardTokenAddress_: string,
  rewardAmount_: number | string,
  witnessAddress_: string,
  contract_: Contract = contract
) => {
  const tx = prepareInvokeTx(
    {
      dApp: contract_.dApp,
      call: {
        function: 'init',
        args: [
          { type: 'integer', value: minSecDepo_ },
          { type: 'integer', value: punishment_ },
          { type: 'integer', value: resetBlockDelta_ },
          { type: 'string', value: rewardTokenAddress_ },
          { type: 'integer', value: rewardAmount_ },
          { type: 'string', value: witnessAddress_ },
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

export const setActiveSigners = async (
  execChainId_: number | string,
  signers_: any[],
  t_: number,
  signerGroupPublicKey_: string,
  contract_: Contract = contract
) => {
  const tx = prepareInvokeTx(
    {
      dApp: contract.dApp,
      call: {
        function: 'setActiveSigners',
        args: [
          { type: 'integer', value: execChainId_ },
          { type: 'list', value: signers_ },
          { type: 'integer', value: t_ },
          { type: 'string', value: signerGroupPublicKey_ },
        ],
      },
    },
    { privateKey: contract_.privateKey }
  );
  await setTxSign(contract_.dApp, tx.id);
  await sendTransaction(tx);
};

export const addSecurityDeposit = async (
  recipient_: string,
  payment_: any[],
  caller_: Contract | Account = contract
) => {
  const privateKey =
    typeof caller_.privateKey == 'string'
      ? { privateKey: caller_.privateKey }
      : caller_.privateKey;
  await invoke(
    {
      dApp: contract.dApp,
      call: {
        function: 'addSecurityDeposit',
        args: [{ type: 'string', value: recipient_ }],
      },
      payment: payment_,
    },
    privateKey,
    env.network
  );
};

export const subSecurityDeposit = async (
  amount_: number,
  caller_: Contract | Account = contract
) => {
  const privateKey =
    typeof caller_.privateKey == 'string'
      ? { privateKey: caller_.privateKey }
      : caller_.privateKey;
  await invoke(
    {
      dApp: contract.dApp,
      call: {
        function: 'subSecurityDeposit',
        args: [{ type: 'integer', value: amount_ }],
      },
    },
    privateKey,
    env.network
  );
};

export const submitR = async (
  eventId_: number,
  execChainId_: number,
  r_: string,
  caller_: Contract | Account = contract
) => {
  const privateKey =
    typeof caller_.privateKey == 'string'
      ? { privateKey: caller_.privateKey }
      : caller_.privateKey;
  await invoke(
    {
      dApp: contract.dApp,
      call: {
        function: 'submitR',
        args: [
          { type: 'integer', value: eventId_ },
          { type: 'integer', value: execChainId_ },
          { type: 'string', value: r_ },
        ],
      },
    },
    privateKey,
    env.network
  );
};

export const submitS = async (
  eventId_: number,
  execChainId_: number,
  rSigma_: string,
  s_: string,
  sSigma_: string,
  caller_: Contract | Account = contract
) => {
  const privateKey =
    typeof caller_.privateKey == 'string'
      ? { privateKey: caller_.privateKey }
      : caller_.privateKey;
  await invoke(
    {
      dApp: contract.dApp,
      call: {
        function: 'submitS',
        args: [
          { type: 'integer', value: eventId_ },
          { type: 'integer', value: execChainId_ },
          { type: 'string', value: rSigma_ },
          { type: 'string', value: s_ },
          { type: 'string', value: sSigma_ },
        ],
      },
    },
    privateKey,
    env.network
  );
};

export const reset = async (
  eventId_: number,
  execChainId_: number,
  r_: string,
  caller_: Contract | Account = contract
) => {
  const privateKey =
    typeof caller_.privateKey == 'string'
      ? { privateKey: caller_.privateKey }
      : caller_.privateKey;
  await invoke(
    {
      dApp: contract.dApp,
      call: {
        function: 'reset',
        args: [
          { type: 'integer', value: eventId_ },
          { type: 'integer', value: execChainId_ },
          { type: 'string', value: r_ },
        ],
      },
    },
    privateKey,
    env.network
  );
};
