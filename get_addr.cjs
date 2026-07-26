const { ethers } = require('./node_modules/ethers');
const { readFileSync } = require('fs');

// 获取正确的 checksum 地址
const provider = new ethers.providers.JsonRpcProvider('https://sepolia-rpc.giwa.io');
const wallet = new ethers.Wallet('0x48f9e8c49a7f6bfc262d8de820474ba1bdd54232fe3aa6fa2b952d8706de3ef4', provider);

// 用 eth_getTransactionReceipt 获取部署交易的正确地址
async function main() {
  // nonce 9 = deployment of 0xba8224...
  // nonce 18 = current
  // 所以 nonce 9 = 10th transaction = index 9 in the sequence
  
  // 获取当前的 nonce
  const nonce = parseInt(await provider.send('eth_getTransactionCount', [wallet.address, 'latest']));
  console.log('Current nonce:', nonce);
  
  // 找到部署交易的正确地址 - 从 explorer 的 raw input data
  // 实际上部署的 input data 就是 bytecode
  // 部署地址 = wallet.address 计算的 create address = keccak256(wallet || nonce-1)[12:]
  
  // wallet address: 0xC43943A9FFe891e175cb21190e642831e6403259
  // nonce at deploy time = 9 (from explorer)
  // 所以合约地址 = keccak256(0xC43943A9FFe891e175cb21190e642831e6403259 || 9)[12:]
  
  // 用 provider.getSigner 时 ethers 内部会计算
  // 让我们直接获取 nonce=9 的那笔交易的收据
  // 其实最简单的是直接用 ethers 重新部署
  
  console.log('Re-deploying to get correct address...');
  const artifact = JSON.parse(readFileSync('./artifacts/contracts/GiwaLotteryV2.sol/GiwaLotteryV2.json', 'utf8'));
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy({ gasLimit: 5000000 });
  await contract.deployed();
  console.log('Deployed at (ethers):', contract.address);
  console.log('Length:', contract.address.length);
  
  // 现在用这个正确的地址 configure
  const c = new ethers.Contract(contract.address, artifact.abi, wallet);
  console.log('Configuring...');
  const tx = await c.configure('1000000000000000', 50, 3600, 1000, { gasLimit: 200000 });
  await tx.wait();
  console.log('Configure success!');
  const config = await c.getConfig();
  console.log('Price:', config._ticketPrice.toString());
  console.log('New address:', contract.address);
}
main().catch(e => console.error(e.message));
