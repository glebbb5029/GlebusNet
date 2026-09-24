import hardhatEthers from "@nomicfoundation/hardhat-ethers";

export default {
    plugins: [hardhatEthers],

    solidity: "0.8.28",

    networks: {
        glebusnet: {
            type: "http",
            url: "http://127.0.0.1:3000",
            chainId: 7777
        }
    }
};