import { base58Encode, TPrivateKey } from '@waves/ts-lib-crypto';
import {
  Account,
  Asset,
  Contract,
  invoke,
  LONG,
  NetworkConfig,
} from '@pepe-team/waves-sc-test-utils';
import { getEnvironment } from 'relax-env-json';
import {
  broadcast,
  IDataParams,
  waitForTx,
  data as wavesData,
  IInvokeScriptParams,
  invokeScript,
  transfer,
  nodeInteraction,
} from '@waves/waves-transactions';
import { fetchDetails } from '@waves/node-api-js/cjs/api-node/assets';
const env = getEnvironment();

let multisigContract: Contract;
let techUser: Account;

export const setSteps = function (contract: Contract, user: Account) {
  multisigContract = contract;
  techUser = user;
};

export const getMultisigContract = function (): Contract {
  return multisigContract;
};

export const getTechUser = function (): Account {
  return techUser;
};

export const setTxMultisig = async function (
  contractAddress: string,
  txid: string,
  owners: Account[]
) {
  for (let i = 0; i < owners.length; i++) {
    await invoke(
      {
        dApp: multisigContract.dApp,
        call: {
          function: 'confirmTransaction',
          args: [
            { type: 'string', value: contractAddress },
            { type: 'string', value: base58Encode(txid) },
          ],
        },
        payment: [{ assetId: null, amount: env.network.invokeFee }],
      },
      owners[i].privateKey,
      env.network
    );
  }
};

export const setTxSign = async function (
  contractAddress: string,
  txid: string,
  value = true
) {
  let invokeData: IInvokeScriptParams<LONG>;
  switch (multisigContract.name) {
    case 'multisig':
      invokeData = {
        dApp: multisigContract.dApp,
        call: {
          function: 'confirmTransaction',
          args: [
            { type: 'string', value: contractAddress },
            { type: 'string', value: base58Encode(txid) },
          ],
        },
      };
      break;
    default:
      invokeData = {
        dApp: multisigContract.dApp,
        call: {
          function: 'setMultisigParams',
          args: [
            { type: 'string', value: contractAddress },
            { type: 'string', value: base58Encode(txid) },
            { type: 'boolean', value: value },
          ],
        },
      };
  }
  await invoke(invokeData, techUser.privateKey, env.network);
};

export const sendTransaction = async function (tx: any) {
  await broadcast(tx, env.network.nodeAPI);
  const txMined = await waitForTx(tx.id, {
    apiBase: env.network.nodeAPI,
    timeout: env.network.nodeTimeout,
  });
  if (txMined.applicationStatus !== 'succeeded') {
    throw new Error('Transaction failed!');
  }
};

export const prepareDataTx = async function (
  contract: Contract,
  data: IDataParams
) {
  return wavesData(
    {
      data: data.data,
      fee: env.network.invokeFee,
      additionalFee: env.network.additionalFee,
      senderPublicKey: contract.publicKey,
      chainId: env.network.chainID,
    },
    contract.privateKey
  );
};

export const prepareInvokeTx = function (
  params: IInvokeScriptParams<LONG>,
  privateKey: TPrivateKey
) {
  return invokeScript(
    {
      dApp: params.dApp,
      feeAssetId: params.feeAssetId || null,
      call: params.call,
      payment: params.payment,
      fee: params.fee || env.network.invokeFee,
      additionalFee: params.additionalFee,
      chainId: params.chainId || env.network.chainID,
    },
    privateKey
  );
};

export const setSignedContext = async function (
  contract: Contract,
  data: IDataParams
) {
  const tx = await prepareDataTx(contract, data);
  await setTxSign(contract.dApp, tx.id);
  return await sendTransaction(tx);
};

export type Sender = {
  address: string;
  publicKey: string;
  privateKey: string;
};

export const signedTransfer = async function (
  sender: Sender,
  recpAddress: string,
  amount: number,
  assetId: string | null = null
) {
  const tx = transfer(
    {
      recipient: recpAddress,
      amount: amount,
      assetId: assetId,
      fee: env.network.transferFee,
      feeAssetId: null,
      chainId: env.network.chainID,
      senderPublicKey: sender.publicKey,
    },
    { privateKey: sender.privateKey }
  );
  await setTxSign(sender.address, tx.id);
  await sendTransaction(tx);
};

export const setInt = async function (
  contract: Contract,
  user: Account,
  value: LONG
) {
  const params: IInvokeScriptParams<LONG> = {
    dApp: contract.dApp,
    call: {
      function: 'bigintToBinary',
      args: [{ type: 'integer', value: value }],
    },
    payment: [{ assetId: null, amount: env.network.invokeFee }],
  };
  return await invoke(params, user.privateKey, env.network);
};

export const setTCClaim = async function (
  contract_: Contract,
  isRightCaller_: boolean,
  reward_: number,
  compensation_ = env.network.invokeFee,
  fee_ = 0,
  adminAddress_ = multisigContract.dApp
) {
  await invoke(
    {
      dApp: contract_.dApp,
      call: {
        function: 'setClaim',
        args: [
          { type: 'boolean', value: isRightCaller_ },
          { type: 'integer', value: reward_ },
          { type: 'integer', value: compensation_ },
          { type: 'integer', value: fee_ },
          { type: 'string', value: adminAddress_ },
        ],
      },
    },
    { privateKey: contract_.privateKey },
    env.network
  );
};

export const setTCStake = async function (
  contract_: Contract,
  isRightCaller_: boolean
) {
  await invoke(
    {
      dApp: contract_.dApp,
      call: {
        function: 'setStake',
        args: [{ type: 'boolean', value: isRightCaller_ }],
      },
    },
    { privateKey: contract_.privateKey },
    env.network
  );
};

export const resetMintData = async function (techContract_: Contract) {
  return await invoke(
    {
      dApp: techContract_.dApp,
      call: { function: 'resetMintData' },
    },
    techUser.privateKey,
    env.network
  );
};

/**
 * MOVE TO UTILS!!!
 */
export const getAssetInfo = async function (assetId_: string) {
  return await fetchDetails(env.network.nodeAPI, assetId_);
};

export const getAssetContractBalance = async (
  asset: Asset | string,
  account: Contract,
  network: NetworkConfig
): Promise<number> => {
  const assetBalance = await nodeInteraction.assetBalance(
    typeof asset == 'string' ? asset : asset.assetId,
    account.dApp,
    network.nodeAPI
  );
  return parseInt(assetBalance.toString());
};

export const concatenateBytes = (dataArray: Uint8Array[]): Uint8Array => {
  let size = 0;
  dataArray.forEach((i) => {
    size = size + i.length;
  });
  const result = new Uint8Array(size);
  let itemSize = 0;
  for (let i = 0; i < dataArray.length; i++) {
    result.set(dataArray[i], itemSize);
    itemSize = itemSize + dataArray[i].length;
  }
  return result;
};
