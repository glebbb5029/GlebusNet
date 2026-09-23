import { ethers } from "ethers";

const RPC_URL = "https://glebusnet.onrender.com";

const TOKEN_ADDRESS =
    "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const provider = new ethers.JsonRpcProvider(RPC_URL);

const tokenAbi = [
    "event Transfer(address indexed from, address indexed to, uint256 value)"
];

const iface = new ethers.Interface(tokenAbi);

const token = new ethers.Contract(
    TOKEN_ADDRESS,
    tokenAbi,
    provider
);

const network = await provider.getNetwork();
const latestBlock = await provider.getBlockNumber();

console.log("==============================================");
console.log("              GLEBUSNET EXPLORER");
console.log("==============================================");
console.log("Chain ID:", network.chainId.toString());
console.log("Последний блок:", latestBlock);
console.log("GLB contract:", TOKEN_ADDRESS);
console.log("==============================================");
console.log("");

const START_BLOCK = Math.max(0, latestBlock - 20);

for (let blockNumber = START_BLOCK; blockNumber <= latestBlock; blockNumber++) {
    const block = await provider.getBlock(blockNumber, true);

    if (!block) continue;

    const date = new Date(Number(block.timestamp) * 1000);

    console.log("");
    console.log("##############################################");
    console.log(`БЛОК #${blockNumber}`);
    console.log("Время:", date.toLocaleString("ru-RU"));
    console.log("Hash:", block.hash);
    console.log("Транзакций:", block.transactions.length);
    console.log("##############################################");

    for (const txHash of block.transactions) {
        const tx = await provider.getTransaction(txHash);
        const receipt = await provider.getTransactionReceipt(txHash);

        if (!tx || !receipt) continue;

        console.log("");
        console.log("----------------------------------------------");
        console.log("TRANSACTION");
        console.log("----------------------------------------------");

        console.log("Hash:", tx.hash);
        console.log("From:", tx.from);
        console.log("To:", tx.to);

        console.log(
            "Native value:",
            ethers.formatEther(tx.value),
            "GLB"
        );

        console.log("Gas used:", receipt.gasUsed.toString());

        const gasPrice = receipt.gasPrice ?? tx.gasPrice;

        if (gasPrice) {
            const fee = receipt.gasUsed * gasPrice;

            console.log(
                "Комиссия:",
                ethers.formatEther(fee),
                "GLB"
            );
        }

        console.log(
            "Статус:",
            receipt.status === 1 ? "УСПЕШНО" : "ОШИБКА"
        );

        console.log("Блок:", receipt.blockNumber);

        // Ищем события GLB Transfer
        for (const log of receipt.logs) {
            if (
                log.address.toLowerCase() !==
                TOKEN_ADDRESS.toLowerCase()
            ) {
                continue;
            }

            try {
                const parsed = iface.parseLog(log);

                if (parsed?.name === "Transfer") {
                    console.log("");
                    console.log("🪙 GLB TRANSFER");

                    console.log(
                        "From:",
                        parsed.args.from
                    );

                    console.log(
                        "To:",
                        parsed.args.to
                    );

                    console.log(
                        "Amount:",
                        ethers.formatUnits(
                            parsed.args.value,
                            18
                        ),
                        "GLB"
                    );
                }
            } catch {
                // Не Transfer event
            }
        }
    }
}

console.log("");
console.log("==============================================");
console.log("Конец просмотра GlebusNet");
console.log("==============================================");