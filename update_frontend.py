#!/usr/bin/env python3
"""
Update index.html with deployed contract address and ABI.
Run after deploy.js: node update_frontend.py <contract_address>
"""
import sys
import json
import re

def main():
    if len(sys.argv) < 2:
        print("Usage: python update_frontend.py <contract_address>")
        sys.exit(1)

    contract_addr = sys.argv[1]

    # Load ABI
    with open('contracts/lottery_abi.json') as f:
        abi = json.load(f)

    # Load index.html
    with open('index.html', 'r') as f:
        html = f.read()

    # Replace contract address
    html = re.sub(
        r"CONTRACT_ADDRESS = '[^']*'",
        f"CONTRACT_ADDRESS = '{contract_addr}'",
        html
    )

    # Replace ABI
    html = re.sub(
        r"let ABI = \[\];",
        f"let ABI = {json.dumps(abi)};",
        html
    )

    with open('index.html', 'w') as f:
        f.write(html)

    print(f"Updated: contract address = {contract_addr}")
    print(f"Updated: ABI entries = {len(abi)}")

if __name__ == '__main__':
    main()
