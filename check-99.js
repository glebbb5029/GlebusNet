import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(
    "https://glebusnet.onrender.com"
);

const TOKEN =
    "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const FROM =
    "0x605cd4AD0dA00423350b53922dB4f492e6d75c2B";

const TO =
    "0x86605bd244F6718804D4e30F25c6B31e4D4F0528";

const token = new ethers.Contract(
    TOKEN,
    [
        "function balanceOf(address) view returns (uint256)",
        "function transfer(address to, uint256 amount) returns (bool)"
    ],
    provider
);

const balance = await token.balanceOf(FROM);

console.log(
    "Баланс токена:",
    ethers.formatUnits(balance, 18),
    "GLB"
);

const amount = ethers.parseUnits("99", 18);

console.log(
    "Проверяем перевод:",
    ethers.formatUnits(amount, 18),
    "GLB"
);

const gas = await token.transfer.estimateGas(TO, amount, {
    from: FROM
});

console.log("Gas:", gas.toString());

const feeData = await provider.getFeeData();

console.log(
    "Gas price:",
    ethers.formatUnits(feeData.gasPrice, "gwei"),
    "gwei"
);

console.log(
    "Примерная комиссия:",
    ethers.formatEther(gas * feeData.gasPrice),
    "native GLB"
);

console.log("✅ Сеть принимает перевод 99 GLB");