import * as network from "./network";

export const DISTRIBUTER: { [net: string]: string } = {
  [network.ETHEREUM]: "",
  [network.XTERIO]: "0x4043F82F4Fe023abA65D78eC8B9315FB14f3ef81",
  [network.SEPOLIA]: "0x3340be02634638DE899454584E41889149630fD2",
  [network.GOERLI]: "0xCc3D48dfFa59123888F6551184623A4477cdB9fb",
};
export const FANSCREATEBNB: { [net: string]: string } = {
  [network.XTERIO]: "0x7e913A13740ab75df2B34249059879948F5157D0",
  [network.XTERIO_TESTNET]: "0xF4bC501659fE25CB9D01b3e90A079854F265d8D3",
};