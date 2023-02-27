import { Account, Contract, invoke } from '@pepe-team/waves-sc-test-utils';
import { prepareInvokeTx, sendTransaction, setTxSign } from './common';
import { getEnvironment } from 'relax-env-json';
const env = getEnvironment();

let contract: Contract;

export const setContract = (contract_: Contract) => {
  contract = contract_;
};

export const init = async (
  pauser_: string,
  chainId_: any,
  signerPublicKey_: string,
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
          { type: 'string', value: signerPublicKey_ },
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

export const updateSigner = async (
  newSignerPublicKey_: string,
  oldSignature_: string,
  newSignature_: string,
  contract_: Contract = contract
) => {
  const tx = prepareInvokeTx(
    {
      dApp: contract.dApp,
      call: {
        function: 'updateSigner',
        args: [
          { type: 'string', value: newSignerPublicKey_ },
          { type: 'string', value: oldSignature_ },
          { type: 'string', value: newSignature_ },
        ],
      },
    },
    { privateKey: contract_.privateKey }
  );
  await setTxSign(contract_.dApp, tx.id);
  await sendTransaction(tx);
};

// export const execute = async (
//   calledContract_: string,
//   funcName_: string,
//   funcArgs_: string[],
//   calledChainID_: 
//   caller_: Contract | Account,
//   contract_: Contract = contract
// ) => {
//   const privateKey =
//     typeof caller_.privateKey == 'string'
//       ? { privateKey: caller_.privateKey }
//       : caller_.privateKey;
//   return await invoke(
//     {
//       dApp: contract_.dApp,
//       call: {
//         function: 'unpause',
//       },
//     },
//     privateKey,
//     env.network
//   );
// };
