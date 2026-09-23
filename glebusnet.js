import { ethers } from "ethers";

const RPC_URL = "https://glebusnet.onrender.com";

const TOKEN_ADDRESS =
    "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const provider = new ethers.JsonRpcProvider(RPC_URL);

const token = new ethers.Contract(
    TOKEN_ADDRESS,
    [
        "function name() view returns (string)",
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)",
        "function totalSupply() view returns (uint256)",
        "function balanceOf(address) view returns (uint256)",
        "event Transfer(address indexed from, address indexed to, uint256 value)"
    ],
    provider
);

function line() {
    console.log(
        "=================================================="
    );
}

function help() {
    line();
    console.log("              GLEBUSNET EXPLORER");
    line();

    console.log("");
    console.log("Команды:");
    console.log("");
    console.log("  !glebusnet help");
    console.log("      Показать список команд");
    console.log("");

    console.log("  !glebusnet status");
    console.log("      Состояние сети");
    console.log("");

    console.log("  !glebusnet block");
    console.log("      Показать последний блок");
    console.log("");

    console.log("  !glebusnet block <номер>");
    console.log("      Информация о конкретном блоке");
    console.log("");

    console.log("  !glebusnet blocks");
    console.log("      Последние 10 блоков");
    console.log("");

    console.log("  !glebusnet tx <hash>");
    console.log("      Информация о транзакции");
    console.log("");

    console.log("  !glebusnet address <адрес>");
    console.log("      Баланс адреса");
    console.log("");

    console.log("  !glebusnet token");
    console.log("      Информация о токене");
    console.log("");

    console.log("  !glebusnet transfers");
    console.log("      Последние переводы токена");
    console.log("");

    line();
}

async function status() {
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    const feeData = await provider.getFeeData();

    line();
    console.log("GLEBUSNET STATUS");
    line();

    console.log("RPC:", RPC_URL);
    console.log("Chain ID:", network.chainId.toString());
    console.log("Последний блок:", blockNumber);

    if (feeData.gasPrice) {
        console.log(
            "Gas price:",
            ethers.formatUnits(feeData.gasPrice, "gwei"),
            "gwei"
        );
    }

    line();
}

async function showBlock(number) {
    let blockNumber = number;

    if (blockNumber === undefined) {
        blockNumber = await provider.getBlockNumber();
    }

    const block = await provider.getBlock(
        Number(blockNumber),
        true
    );

    if (!block) {
        console.log("Блок не найден.");
        return;
    }

    line();
    console.log(`GLEBUSNET BLOCK #${block.number}`);
    line();

    console.log("Hash:", block.hash);
    console.log("Parent:", block.parentHash);
    console.log(
        "Время:",
        new Date(Number(block.timestamp) * 1000).toLocaleString(
            "ru-RU"
        )
    );

    console.log(
        "Транзакций:",
        block.transactions.length
    );

    if (block.transactions.length > 0) {
        console.log("");
        console.log("Транзакции:");

        for (const tx of block.transactions) {
            console.log("  ", tx);
        }
    }

    line();
}

async function showBlocks() {
    const latest = await provider.getBlockNumber();

    const start = Math.max(0, latest - 9);

    line();
    console.log("ПОСЛЕДНИЕ БЛОКИ");
    line();

    for (let i = latest; i >= start; i--) {
        const block = await provider.getBlock(i);

        if (!block) continue;

        const date = new Date(
            Number(block.timestamp) * 1000
        );

        console.log(
            `#${block.number} | ${block.transactions.length} tx | ${date.toLocaleString("ru-RU")}`
        );

        console.log(
            `   ${block.hash}`
        );
    }

    line();
}

async function showTransaction(hash) {
    const tx = await provider.getTransaction(hash);

    if (!tx) {
        console.log("Транзакция не найдена.");
        return;
    }

    const receipt =
        await provider.getTransactionReceipt(hash);

    line();
    console.log("GLEBUSNET TRANSACTION");
    line();

    console.log("Hash:", tx.hash);
    console.log("From:", tx.from);
    console.log("To:", tx.to);

    console.log(
        "Native value:",
        ethers.formatEther(tx.value)
    );

    if (receipt) {
        console.log(
            "Статус:",
            receipt.status === 1
                ? "УСПЕШНО"
                : "ОШИБКА"
        );

        console.log(
            "Блок:",
            receipt.blockNumber
        );

        console.log(
            "Gas used:",
            receipt.gasUsed.toString()
        );

        const gasPrice =
            receipt.gasPrice ?? tx.gasPrice;

        if (gasPrice) {
            const fee =
                receipt.gasUsed * gasPrice;

            console.log(
                "Комиссия:",
                ethers.formatEther(fee),
                "native GLB"
            );
        }

        for (const log of receipt.logs) {
            if (
                log.address.toLowerCase() !==
                TOKEN_ADDRESS.toLowerCase()
            ) {
                continue;
            }

            try {
                const parsed =
                    token.interface.parseLog(log);

                if (parsed?.name === "Transfer") {
                    console.log("");
                    console.log("TOKEN TRANSFER");

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
                        )
                    );
                }
            } catch {}
        }
    }

    line();
}

async function showAddress(address) {
    if (!ethers.isAddress(address)) {
        console.log("Неверный Ethereum-адрес.");
        return;
    }

    const nativeBalance =
        await provider.getBalance(address);

    const tokenBalance =
        await token.balanceOf(address);

    line();
    console.log("GLEBUSNET ADDRESS");
    line();

    console.log("Address:", address);

    console.log(
        "Native GLB:",
        ethers.formatEther(nativeBalance)
    );

    console.log(
        "Token:",
        ethers.formatUnits(tokenBalance, 18)
    );

    line();
}

async function showToken() {
    const name = await token.name();
    const symbol = await token.symbol();
    const decimals = await token.decimals();
    const supply = await token.totalSupply();

    line();
    console.log("GLEBUSNET TOKEN");
    line();

    console.log("Contract:", TOKEN_ADDRESS);
    console.log("Name:", name);
    console.log("Symbol:", symbol);
    console.log("Decimals:", decimals);

    console.log(
        "Total supply:",
        ethers.formatUnits(supply, decimals)
    );

    line();
}

async function showTransfers() {
    const latest = await provider.getBlockNumber();

    const start = Math.max(0, latest - 50);

    const filter = token.filters.Transfer();

    const events = await token.queryFilter(
        filter,
        start,
        latest
    );

    line();
    console.log("ПОСЛЕДНИЕ TOKEN TRANSFERS");
    line();

    if (events.length === 0) {
        console.log("Переводов пока нет.");
        line();
        return;
    }

    const lastEvents = events.slice(-20);

    for (const event of lastEvents) {
        const args = event.args;

        console.log("");
        console.log("Block:", event.blockNumber);
        console.log("Tx:", event.transactionHash);

        console.log(
            "From:",
            args.from
        );

        console.log(
            "To:",
            args.to
        );

        console.log(
            "Amount:",
            ethers.formatUnits(
                args.value,
                18
            )
        );
    }

    line();
}

async function main() {
    const input = process.argv
        .slice(2)
        .join(" ")
        .trim();

    if (!input) {
        help();
        return;
    }

    const parts = input.split(/\s+/);

    let command = parts[0].toLowerCase();

    if (command === "!glebusnet") {
        command = parts[1]?.toLowerCase();
        parts.splice(0, 2);
    } else if (command.startsWith("!glebusnet")) {
        command = command
            .replace("!glebusnet", "")
            .toLowerCase();

        parts.shift();

        if (!command) {
            help();
            return;
        }
    } else {
        console.log(
            'Команда должна начинаться с "!glebusnet".'
        );
        console.log(
            'Напиши: !glebusnet help'
        );
        return;
    }

    try {
        switch (command) {
            case "help":
                help();
                break;

            case "status":
                await status();
                break;

            case "block":
                await showBlock(parts[0]);
                break;

            case "blocks":
                await showBlocks();
                break;

            case "tx":
                if (!parts[0]) {
                    console.log(
                        "Использование: !glebusnet tx <hash>"
                    );
                    return;
                }

                await showTransaction(parts[0]);
                break;

            case "address":
                if (!parts[0]) {
                    console.log(
                        "Использование: !glebusnet address <address>"
                    );
                    return;
                }

                await showAddress(parts[0]);
                break;

            case "token":
                await showToken();
                break;

            case "transfers":
                await showTransfers();
                break;

            default:
                console.log(
                    `Неизвестная команда: ${command}`
                );
                console.log(
                    "Используй: !glebusnet help"
                );
        }
    } catch (error) {
        console.error("");
        console.error("Ошибка:", error.message);
    }
}

main();