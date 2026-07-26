import { ethers } from 'ethers';
import { readFileSync } from 'fs';

const provider = new ethers.providers.JsonRpcProvider('https://sepolia-rpc.giwa.io');
const wallet = new ethers.Wallet('0x48f9e8c49a7f6bfc262d8de820474ba1bdd54232fe3aa6fa2b952d8706de3ef4', provider);

const artifact = JSON.parse(readFileSync('./artifacts/contracts/GiwaLotteryV2.sol/GiwaLotteryV2.json', 'utf8'));
const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

// 检查旧合约是否需要重新部署
const oldAddr = '0xba8224e866122b3ec3e11ee4f6f84074b2555fc';
const code = await provider.getCode(oldAddr);
console.log('Old contract code length:', code.length);

if (code.length > 100) {
  console.log('Contract exists. Getting manager via call...');
  // 用 raw call 检查 manager
  try {
    const manager = await provider.call({ to: oldAddr, data: '0xfee2b4b0' });
    console.log('Manager result:', manager);
  } catch(e) {
    console.log('Call reverted - not a lottery contract');
  }
  
  // 试试 configure
  console.log('Attempting configure on old contract...');
  const abi = artifact.abi;
  const c = new ethers.Contract(oldAddr, abi, wallet);
  try {
    const tx = await c.configure('1000000000000000', 50, 3600, 1000, { gasLimit: 200000 });
    await tx.wait();
    console.log('Configure success!');
    console.log('Old contract IS the lottery! Address:', oldAddr);
    console.log('DONT REDEPLOY');
  } catch(e) {
    console.log('Configure failed:', e.message.slice(0, 100));
    console.log('Need to deploy new contract');
  }
} else {
  console.log('No contract at old address. Deploying new...');
  const contract = await factory.deploy({ gasLimit: 5000000 });
  await contract.deployed();
  console.log('New deployed at:', contract.address);
  console.log('Configuring...');
  const tx2 = await contract.configure('1000000000000000', 50, 3600, 1000, { gasLimit: 200000 });
  await tx2.wait();
  console.log('Done!');
}
