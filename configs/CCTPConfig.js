let cctp = new Map(
    ["Eth",{
        domain:"0",
        tokenMessenger:"0xbd3fa81b58ba92a82136038b25adec7066af3155",
        messageTransmitter:"0x0a992d191deec32afe36203ad87d7d289a738f81",
        tokenMinter:"0xc4922d64a24675e16e1586e3e3aa56c06fabe907",
    }],
    ["Avalanche",{
        domain:"1",
        tokenMessenger:"0x6b25532e1060ce10cc3b0a99e5683b91bfde6982",
        messageTransmitter:"0x8186359af5f57fbb40c6b14a588d2a59c0c29880",
        tokenMinter:"0x420f5035fd5dc62a167e7e7f08b604335ae272b8",
    }],
    ["Optimism",{
        domain:"2",
        tokenMessenger:"0x2B4069517957735bE00ceE0fadAE88a26365528f",
        messageTransmitter:"0x4d41f22c5a0e5c74090899e5a8fb597a8842b3e8",
        tokenMinter:"0x33E76C5C31cb928dc6FE6487AB3b2C0769B1A1e3",
    }],
    ["Arbitrum",{
        domain:"3",
        tokenMessenger:"0x19330d10D9Cc8751218eaf51E8885D058642E08A",
        messageTransmitter:"0xC30362313FBBA5cf9163F0bb16a0e01f01A896ca",
        tokenMinter:"0xE7Ed1fa7f45D05C508232aa32649D89b73b8bA48",
    }],




    ["Goerli",{
        domain:"0",
        tokenMessenger:"0xd0c3da58f55358142b8d3e06c1c30c5c6114efe8",
        messageTransmitter:"0x26413e8157cd32011e726065a5462e97dd4d03d9",
        tokenMinter:"0xca6b4c00831ffb77afe22e734a6101b268b7fcbe",
    }],
    ["Fuji",{
        domain:"1",
        tokenMessenger:"0xeb08f243e5d3fcff26a9e38ae5520a669f4019d0",
        messageTransmitter:"0xa9fb1b3009dcb79e2fe346c16a604b8fa8ae0a79",
        tokenMinter:"0x4ed8867f9947a5fe140c9dc1c6f207f3489f501e",
    }],
)



exports.getCCTP = function(network) {
    return cctp.get(network);
}  