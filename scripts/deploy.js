import hre from "hardhat";

const { ethers } = await hre.network.connect();

const token = await ethers.deployContract("GlebusToken", [
    ethers.parseUnits("1000000", 18)
]);

await token.waitForDeployment();

console.log("GLB deployed to:", await token.getAddress());