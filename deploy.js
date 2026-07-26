/**
 * GIWA Lottery V2 部署脚本
 */
require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');

const RPC = 'https://sepolia-rpc.giwa.io';
const CHAIN_ID = 91342;

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error('需要设置 DEPLOYER_PRIVATE_KEY');

  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(pk, provider);
  const addr = wallet.address;

  const balance = await provider.getBalance(addr);
  console.log('👛 钱包:', addr);
  console.log('💰 余额:', ethers.utils.formatEther(balance), 'ETH');
  console.log();

  // 加载 ABI 和 Bytecode
  const artifact = JSON.parse(
    fs.readFileSync('./artifacts/contracts/GiwaLotteryV2.sol/GiwaLotteryV2.json', 'utf8')
  );
  const abi = artifact.abi;
  const bytecode = artifact.bytecode;

  // 估算 gas
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const deployTx = factory.getDeployTransaction();
  console.log('📡 估算 Gas 中...');

  try {
    const gasEstimate = await provider.estimateGas(deployTx);
    console.log('⛽ Gas 估算:', gasEstimate.toString());
  } catch (e) {
    console.log('⚠️ Gas 估算失败，尝试强制部署:', e.message.split('\n')[0]);
  }

  // 构建交易，手动设置 gas
  const nonce = await provider.getTransactionCount(addr);
  console.log('🔢 Nonce:', nonce);

    const gasPrice = ethers.utils.parseUnits('1100000', 'wei'); // ~1.1M wei (above current ~1M)
    const tx = {
      ...deployTx,
      chainId: CHAIN_ID,
      nonce: nonce,
      gasLimit: 3000000,
      gasPrice: gasPrice,
    };

  console.log('📤 发送部署交易...');
  const sentTx = await wallet.sendTransaction(tx);
  console.log('🔗 Tx:', sentTx.hash);
  console.log('⏳ 等待确认...');

  const receipt = await sentTx.wait();
  if (receipt.status === 1) {
    const contractAddr = ethers.utils.getContractAddress({
      from: addr,
      nonce: nonce
    });
    console.log();
    console.log('🎉 部署成功!');
    console.log('📍 合约地址:', contractAddr);
    console.log();

    // 保存部署信息
    const deployed = {
      network: 'giwa-sepolia',
      chainId: CHAIN_ID,
      contractAddress: contractAddr,
      manager: addr,
      blockNumber: receipt.blockNumber,
      transactionHash: receipt.transactionHash,
      timestamp: new Date().toISOString(),
      abi: abi,
      rpc: RPC
    };
    fs.writeFileSync('./deployed.json', JSON.stringify(deployed, null, 2));
    console.log('💾 已保存到 deployed.json');

    // 自动更新前端
    console.log('🔄 更新前端配置...');
    updateFrontend(contractAddr);
  } else {
    console.log('❌ 部署失败!');
    process.exit(1);
  }
}

function updateFrontend(address) {
  let html = fs.readFileSync('./index.html', 'utf8');

  // 替换合约地址
  html = html.replace(
    /CONTRACT_ADDRESS\s*=\s*['"][^'"]*['"]/,
    `CONTRACT_ADDRESS = '${address}'`
  );

  // 嵌入 ABI
  const abiJson = JSON.stringify(JSON.parse(fs.readFileSync('./deployed.json', 'utf8')).abi);
  html = html.replace(
    /const CONTRACT_ABI\s*=[\s\S]*?;/,
    `const CONTRACT_ABI = ${abiJson};`
  );

  fs.writeFileSync('./index.html', html);
  console.log('✅ 前端已更新，合约地址:', address);
}

main().catch(e => {
  console.error('❌ 错误:', e.message || e);
  process.exit(1);
});
