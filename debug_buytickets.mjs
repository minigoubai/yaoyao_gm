import { ethers } from 'ethers';
import { readFileSync } from 'fs';
const provider = new ethers.providers.JsonRpcProvider('https://sepolia-rpc.giwa.io');
const addr = '0x8aD04D5ce715A81f33805813F514ABb61899C2C2';
const abi = JSON.parse(readFileSync('./contracts/lottery_abi.json', 'utf8'));
const c = new ethers.Contract(addr, abi, provider);

const userAddr = '0xeC82fA0B5956f0FE2C4Ab4dd12B4514127787350';
const price = await c.ticketPrice();
console.log('Price:', price.toString());

// Check contract state
const [phase, total, pool, unique, manager] = await Promise.all([
  c.currentPhase(), c.getTotalTickets(), c.getPrizePool(), c.getUniquePlayerCount(), c.MANAGER()
]);
console.log('Phase:', phase.toString(), '| Total:', total.toString(), '| Pool:', ethers.utils.formatEther(pool), '| Unique:', unique.toString());
console.log('Manager:', manager);

// Try buyTickets with value
try {
  const r = await c.callStatic.buyTickets(1, { value: price });
  console.log('callStatic OK:', r);
} catch(e) {
  console.log('callStatic FAIL code:', e.code);
  console.log('callStatic FAIL data:', e.data);
  const msg = e.message.split('\n')[0];
  console.log('callStatic FAIL msg:', msg);
}

// Try WITHOUT value
try {
  const r = await c.callStatic.buyTickets(1);
  console.log('callStatic (no value) OK:', r);
} catch(e) {
  console.log('callStatic (no value) FAIL:', e.code, e.data);
}

// Check user's ticket count
const userTickets = await c.ticketCount(userAddr);
console.log('User ticketCount:', userTickets.toString());
