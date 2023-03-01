import { Account, Contract, invoke } from '@pepe-team/waves-sc-test-utils';
import { prepareInvokeTx, sendTransaction, setTxSign } from './common';
import { getEnvironment } from 'relax-env-json';
const env = getEnvironment();

let contract: Contract;

export const setContract = (contract_: Contract) => {
  contract = contract_;
};

export const init = async (
  tokenName_: string,
  tokenDescr_: string,
  tokenDecimals_: number,
  contract_: Contract = contract
) => {
  const tx = prepareInvokeTx(
    {
      dApp: contract_.dApp,
      call: {
        function: 'init',
        args: [
          { type: 'string', value: tokenName_ },
          { type: 'string', value: tokenDescr_ },
          { type: 'integer', value: tokenDecimals_ },
        ],
      },
      fee: env.network.issueFee + env.network.invokeFee,
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

export const addMinter = async (
  minter_: string,
  contract_: Contract = contract
) => {
  const tx = prepareInvokeTx(
    {
      dApp: contract_.dApp,
      call: {
        function: 'addMinter',
        args: [{ type: 'string', value: minter_ }],
      },
    },
    { privateKey: contract_.privateKey }
  );
  await setTxSign(contract_.dApp, tx.id);
  await sendTransaction(tx);
};

export const removeMinter = async (
  minter_: string,
  contract_: Contract = contract
) => {
  const tx = prepareInvokeTx(
    {
      dApp: contract_.dApp,
      call: {
        function: 'removeMinter',
        args: [{ type: 'string', value: minter_ }],
      },
    },
    { privateKey: contract_.privateKey }
  );
  await setTxSign(contract_.dApp, tx.id);
  await sendTransaction(tx);
};

export const mint = async (
  amount_: number | string,
  recipient_: string,
  minter_: Account,
  contract_: Contract = contract
) => {
  return await invoke(
    {
      dApp: contract_.dApp,
      call: {
        function: 'mint',
        args: [
          { type: 'integer', value: amount_ },
          { type: 'string', value: recipient_ },
        ],
      },
    },
    minter_.privateKey,
    env.network
  );
};

export const mintMany = async (
  amount_: number | string,
  recipientList_: any[],
  minter_: Account,
  contract_: Contract = contract
) => {
  return await invoke(
    {
      dApp: contract_.dApp,
      call: {
        function: 'mintMany',
        args: [
          { type: 'integer', value: amount_ },
          { type: 'list', value: recipientList_ },
        ],
      },
    },
    minter_.privateKey,
    env.network
  );
};

export const setSponsorshipManager = async (
  manager_: string,
  contract_: Contract = contract
) => {
  const tx = prepareInvokeTx(
    {
      dApp: contract_.dApp,
      call: {
        function: 'setSponsorshipManager',
        args: [{ type: 'string', value: manager_ }],
      },
    },
    { privateKey: contract_.privateKey }
  );
  await setTxSign(contract_.dApp, tx.id);
  await sendTransaction(tx);
};

export const updateSponsorship = async (
  fee_: number | string,
  requiredAmt_: number | string,
  manager_: Account,
  contract_: Contract = contract
) => {
  return await invoke(
    {
      dApp: contract_.dApp,
      call: {
        function: 'updateSponsorship',
        args: [
          { type: 'integer', value: fee_ },
          { type: 'integer', value: requiredAmt_ },
        ],
      },
    },
    manager_.privateKey,
    env.network
  );
};
