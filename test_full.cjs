const { ethers } = require('ethers');
const https = require('https');

const pk = '0x48f9e8c49a7f6bfc262d8de820474ba1bdd54232fe3aa6fa2b952d8706de3ef4';
const RPC = 'https://sepolia-rpc.giwa.io';

function rpc(method, params) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
    const req = https.request(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
    });
    req.write(data); req.end();
  });
}

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(pk, provider);
  const artifact = require('./artifacts/contracts/GiwaLotteryV4.sol/GiwaLotteryV4.json');

  // Read current deployment
  const deployed = require('./deployed.json');
  const addr = deployed.contractAddress;
  console.log('Contract address:', addr);

  const contract = new ethers.Contract(addr, artifact.abi, wallet);
  const roContract = new ethers.Contract(addr, artifact.abi, provider);

  // 1. Check config via eth_call (with from fix)
  console.log('\n=== Config via eth_call ===');
  const fromAddr = '0x0000000000000000000000000000000000000001';
  const configData = await rpc('eth_call', [{ to: addr, data: '0xb6e3b1cb', from: fromAddr }, 'latest']);
  console.log('getConfig():', configData.result);

  const tpData = await rpc('eth_call', [{ to: addr, data: '0x7d3089a7', from: fromAddr }, 'latest']);
  console.log('ticketPrice():', tpData.result, tpData.result ? parseInt(tpData.result) / 1e18 + ' ETH' : 'REVERT');

  const phaseData = await rpc('eth_call', [{ to: addr, data: '0x8c2eb5df', from: fromAddr }, 'latest']);
  console.log('currentPhase():', phaseData.result || phaseData.error);

  const playersData = await rpc('eth_call', [{ to: addr, data: '0x2210a4c3', from: fromAddr }, 'latest']);
  console.log('getPlayers():', playersData.result || playersData.error);

  // 2. Read raw storage
  console.log('\n=== Raw Storage ===');
  for (let i = 0; i <= 8; i++) {
    const s = await rpc('eth_getStorageAt', [addr, '0x' + i.toString(16), 'latest']);
    const val = parseInt(s.result).toString();
    const labels = ['manager', 'ticketPrice', 'maxPlayers', 'duration', 'startTime', 'phase', 'playerCount', 'totalTickets', 'prizePool'];
    console.log('slot', i.toString().padStart(2), labels[i] || '???', ':', val);
  }

  // 3. Test buyTickets
  console.log('\n=== Buy Ticket Test ===');
  const block = await rpc('eth_blockNumber', []);
  const blockData = await rpc('eth_getBlockByNumber', [block.result, false]);
  console.log('Current block timestamp:', parseInt(blockData.result.timestamp, 16));

  const ticketPrice = ethers.utils.parseEther('0.001');
  try {
    const buyTx = await contract.buyTickets(1, { value: ticketPrice });
    console.log('buyTickets TX:', buyTx.hash);
    await buyTx.wait();
    console.log('Buy confirmed!');
  } catch (e) {
    console.log('buyTickets error:', e.reason || e.message);
  }

  // 4. Check state after buy
  console.log('\n=== After Buy ===');
  const playersAfter = await rpc('eth_call', [{ to: addr, data: '0x2210a4c3', from: fromAddr }, 'latest']);
  console.log('getPlayers():', playersAfter.result || playersAfter.error);
  const prizePoolAfter = await rpc('eth_call', [{ to: addr, data: '0xb6e3b1cb', from: fromAddr }, 'latest']);
  console.log('getPrizePool():', prizePoolAfter.result || prizePoolAfter.error);
}

main().catch(console.error);