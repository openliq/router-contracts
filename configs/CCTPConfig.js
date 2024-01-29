let cctp = new Map(
    [
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
        ["Base",{
            domain:"6",
            tokenMessenger:"0x1682Ae6375C4E4A97e4B583BC394c861A46D8962",
            messageTransmitter:"0xAD09780d193884d503182aD4588450C416D6F9D4",
            tokenMinter:"	0xe45B133ddc64bE80252b0e9c75A8E74EF280eEd6",
        }],
        ["Matic",{
            domain:"7",
            tokenMessenger:"0x9daF8c91AEFAE50b9c0E69629D3F6Ca40cA3B3FE",
            messageTransmitter:"0xF3be9355363857F3e001be68856A2f96b4C39Ba9",
            tokenMinter:"0x10f7835F827D6Cf035115E10c50A853d7FB2D2EC",
        }],




        ["MaticTest",{
            domain:"7",
            tokenMessenger:"0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5",
            messageTransmitter:"0xe09A679F56207EF33F5b9d8fb4499Ec00792eA73",
            tokenMinter:"0xE997d7d2F6E065a9A93Fa2175E878Fb9081F1f0A",
        }],
        ["Fuji",{
            domain:"1",
            tokenMessenger:"0xeb08f243e5d3fcff26a9e38ae5520a669f4019d0",
            messageTransmitter:"0xa9fb1b3009dcb79e2fe346c16a604b8fa8ae0a79",
            tokenMinter:"0x4ed8867f9947a5fe140c9dc1c6f207f3489f501e",
        }],
    ]
)



exports.getCCTP = function(network) {
    return cctp.get(network);
}  