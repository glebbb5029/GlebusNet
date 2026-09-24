import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(
    "https://glebusnet.onrender.com"
);

const privateKey =
    "0xТУТ_НУЖЕН_ПРИВАТНЫЙ_КЛЮЧ_КОШЕЛЬКА_A";

const wallet =
    new ethers.Wallet(privateKey, provider);

const token =
    new ethers.Contract(
        "0x5FbDB2315678afecb367f032d93f642f64180aa3",
        [
            "function transfer(address to, uint256 amount) returns (bool)"
        ],
        wallet
    );

const tx =
    await token.transfer(
        "0x082b947c2f7dac4a4d585ab7c715a0d66bc363f2",
        ethers.parseUnits("1", 18)
    );

console.log("TX:", tx.hash);

await tx.wait();

console.log("Подтверждено!");