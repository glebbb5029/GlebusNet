const crypto = require("crypto");

class Block {
    constructor(index, timestamp, data, previousHash = "") {
        this.index = index;
        this.timestamp = timestamp;
        this.data = data;
        this.previousHash = previousHash;
        this.hash = this.calculateHash();
    }

    calculateHash() {
        return crypto
            .createHash("sha256")
            .update(
                this.index +
                this.timestamp +
                JSON.stringify(this.data) +
                this.previousHash
            )
            .digest("hex");
    }
}

class Blockchain {
    constructor() {
        this.chain = [this.createGenesisBlock()];
    }

    createGenesisBlock() {
        return new Block(
            0,
            Date.now(),
            {
                message: "Добро пожаловать в GlebusNet!",
                token: "GLB"
            },
            "0"
        );
    }

    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }
isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
        const currentBlock = this.chain[i];
        const previousBlock = this.chain[i - 1];

        if (currentBlock.hash !== currentBlock.calculateHash()) {
            return false;
        }

        if (currentBlock.previousHash !== previousBlock.hash) {
            return false;
        }
    }

    return true;
}
    addBlock(data) {
        const previousBlock = this.getLatestBlock();

        const newBlock = new Block(
            this.chain.length,
            Date.now(),
            data,
            previousBlock.hash
        );

        this.chain.push(newBlock);
    }
}

const glebusNet = new Blockchain();

glebusNet.addBlock({
    from: "Glebus",
    to: "Alice",
    amount: 100
});

glebusNet.addBlock({
    from: "Alice",
    to: "Bob",
    amount: 25
});

console.log("=== GLEBUSNET ===");
console.log("Количество блоков:", glebusNet.chain.length);
console.log();

console.log("Вся блокчейн-цепочка:");
console.log(glebusNet.chain);
console.log();
console.log("Проверка блокчейна:");
glebusNet.chain[2].data.amount = 25000;
if (glebusNet.isChainValid()) {
    console.log("✅ Блокчейн корректен!");
} else {
    console.log("❌ Блокчейн поврежден!");
}