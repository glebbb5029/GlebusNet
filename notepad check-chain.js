import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(
    "https://glebusnet.onrender.com"
);

const network = await provider.getNetwork();

console.log("Chain ID:", network.chainId.toString());

console.log(
    "Network:",
    network.name
);

console.log(
    "Block:",
    await provider.getBlockNumber()
);

const feeData = await provider.getFeeData();

console.log(
    "Gas price:",
    ethers.formatUnits(feeData.gasPrice, "gwei"),
    "gwei"
);