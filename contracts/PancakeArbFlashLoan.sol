<<<<<<< HEAD
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * PancakeSwap V2/V3 Flash-Loan Arbitrage Contract (hardened)
 * ──────────────────────────────────────────────────────────
 * Improvements over original:
 *  - ReentrancyGuard
 *  - Explicit slippage parameters (bps)
 *  - SafeERC20-style transfer/approve checks
 *  - Cleaner fee calculation + events
 *  - tokenOut removed (arb is always USDT <-> tokenIn)
 *  - Owner can still withdraw profits + adjust gas refund
 *
 * Deploy on BSC Mainnet (Remix or Foundry)
 * Compiler: 0.8.19+, Optimization: 200 runs
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

interface IPancakeV2Pair {
    function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external;
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 r0, uint112 r1, uint32 ts);
}

interface IPancakeV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

interface IPancakeV2Router {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function swapExactTokensForETH(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function getAmountsOut(uint amountIn, address[] calldata path)
        external view returns (uint[] memory amounts);
}

interface IPancakeV3Router {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external payable returns (uint256 amountOut);
}

contract PancakeArbFlashLoan {
    // ─── State ───────────────────────────────────────────────────────────────
    address public owner;
    uint256 public gasRefundUsdt = 5e17;          // 0.5 USDT (18 decimals)
    uint256 private constant REENTRANCY_NOT_ENTERED = 1;
    uint256 private constant REENTRANCY_ENTERED = 2;
    uint256 private _status;

    // BSC Mainnet
    IPancakeV2Factory public constant FACTORY =
        IPancakeV2Factory(0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73);
    IPancakeV2Router public constant V2_ROUTER =
        IPancakeV2Router(0x10ED43C718714eb63d5aA57B78B54704E256024E);
    IPancakeV3Router public constant V3_ROUTER =
        IPancakeV3Router(0x13f4EA83D0bd40E75C8222255bc855a974568Dd4);

    address public constant USDT = 0x55d398326f99059fF775485246999027B3197955;
    address public constant WBNB = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;

    // ─── Events ──────────────────────────────────────────────────────────────
    event ArbitrageExecuted(
        address indexed tokenIn,
        uint256 loanAmount,
        uint256 profit,
        bool v2First,
        uint24 v3Fee
    );
    event GasRefunded(address indexed recipient, uint256 usdtAmount, uint256 bnbReceived);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ─── Modifiers ───────────────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier nonReentrant() {
        require(_status != REENTRANCY_ENTERED, "ReentrancyGuard: reentrant call");
        _status = REENTRANCY_ENTERED;
        _;
        _status = REENTRANCY_NOT_ENTERED;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor() {
        owner = msg.sender;
        _status = REENTRANCY_NOT_ENTERED;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ─── Owner controls ──────────────────────────────────────────────────────
    function setGasRefundUsdt(uint256 amount) external onlyOwner {
        gasRefundUsdt = amount;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ─── Main entry point ────────────────────────────────────────────────────
    /**
     * @param tokenIn     Token to arb against USDT (e.g. WBNB)
     * @param loanAmount  USDT amount to flash-borrow (18 decimals)
     * @param v2First     true = buy on V2 → sell on V3; false = opposite
     * @param v3Fee       100 / 500 / 2500 / 10000
     * @param minProfit   Minimum net profit in USDT after fee + gas refund
     * @param slippageBps Max slippage in basis points (e.g. 50 = 0.5 %)
     */
    function executeArbitrage(
        address tokenIn,
        uint256 loanAmount,
        bool v2First,
        uint24 v3Fee,
        uint256 minProfit,
        uint256 slippageBps
    ) external onlyOwner nonReentrant {
        require(tokenIn != address(0) && tokenIn != USDT, "Bad tokenIn");
        require(loanAmount > 0, "Zero loan");
        require(slippageBps <= 500, "Slippage too high"); // safety cap 5 %

        address pair = FACTORY.getPair(USDT, tokenIn);
        require(pair != address(0), "No V2 pair");

        bytes memory data = abi.encode(
            tokenIn,
            loanAmount,
            v2First,
            v3Fee,
            minProfit,
            slippageBps,
            msg.sender
        );

        IPancakeV2Pair loanPair = IPancakeV2Pair(pair);
        address t0 = loanPair.token0();

        uint256 out0 = (t0 == USDT) ? loanAmount : 0;
        uint256 out1 = (t0 == USDT) ? 0 : loanAmount;

        loanPair.swap(out0, out1, address(this), data);
    }

    // ─── Pancake V2 flash-swap callback ──────────────────────────────────────
    function pancakeCall(
        address /*sender*/,
        uint256 /*amount0*/,
        uint256 /*amount1*/,
        bytes calldata data
    ) external nonReentrant {
        (
            address tokenIn,
            uint256 loanAmount,
            bool v2First,
            uint24 v3Fee,
            uint256 minProfit,
            uint256 slippageBps,
            address caller
        ) = abi.decode(data, (address, uint256, bool, uint24, uint256, uint256, address));

        // Security checks
        address pair = FACTORY.getPair(USDT, tokenIn);
        require(msg.sender == pair, "Unauthorized callback");
        require(caller == owner, "Not owner");

        uint256 startUsdt = IERC20(USDT).balanceOf(address(this));

        // ── Two-leg arbitrage ────────────────────────────────────────────────
        if (v2First) {
            // USDT → tokenIn on V2, then tokenIn → USDT on V3
            uint256 minOutV2 = _getMinOut(USDT, tokenIn, loanAmount, slippageBps);
            _swapV2(USDT, tokenIn, loanAmount, minOutV2);

            uint256 got = IERC20(tokenIn).balanceOf(address(this));
            uint256 minOutV3 = _getMinOut(tokenIn, USDT, got, slippageBps);
            _swapV3(tokenIn, USDT, got, v3Fee, minOutV3);
        } else {
            // USDT → tokenIn on V3, then tokenIn → USDT on V2
            uint256 minOutV3 = _getMinOut(USDT, tokenIn, loanAmount, slippageBps);
            _swapV3(USDT, tokenIn, loanAmount, v3Fee, minOutV3);

            uint256 got = IERC20(tokenIn).balanceOf(address(this));
            uint256 minOutV2 = _getMinOut(tokenIn, USDT, got, slippageBps);
            _swapV2(tokenIn, USDT, got, minOutV2);
        }

        uint256 endUsdt = IERC20(USDT).balanceOf(address(this));

        // Pancake V2 flash fee = 0.25 % → repay = loan * 10025 / 10000 (ceil)
        uint256 repay = (loanAmount * 10025 + 9999) / 10000; // ceiling division
        require(endUsdt >= repay + gasRefundUsdt + minProfit, "Insufficient profit");

        // Repay the pair
        _safeTransfer(USDT, msg.sender, repay);

        // Gas refund in BNB to the bot wallet
        if (gasRefundUsdt > 0) {
            _refundGasInBnb(caller, gasRefundUsdt);
        }

        uint256 profit = endUsdt - repay - gasRefundUsdt;
        emit ArbitrageExecuted(tokenIn, loanAmount, profit, v2First, v3Fee);
    }

    // ─── Internal helpers ────────────────────────────────────────────────────
    function _getMinOut(
        address from,
        address to,
        uint256 amountIn,
        uint256 slippageBps
    ) internal view returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = from;
        path[1] = to;
        uint256[] memory amounts = V2_ROUTER.getAmountsOut(amountIn, path);
        // Apply slippage: minOut = expected * (10000 - bps) / 10000
        return (amounts[1] * (10000 - slippageBps)) / 10000;
    }

    function _swapV2(
        address from,
        address to,
        uint256 amountIn,
        uint256 amountOutMin
    ) internal {
        _safeApprove(from, address(V2_ROUTER), amountIn);
        address[] memory path = new address[](2);
        path[0] = from;
        path[1] = to;
        V2_ROUTER.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            address(this),
            block.timestamp + 60
        );
    }

    function _swapV3(
        address from,
        address to,
        uint256 amountIn,
        uint24 fee,
        uint256 amountOutMin
    ) internal {
        _safeApprove(from, address(V3_ROUTER), amountIn);
        V3_ROUTER.exactInputSingle(
            IPancakeV3Router.ExactInputSingleParams({
                tokenIn: from,
                tokenOut: to,
                fee: fee,
                recipient: address(this),
                amountIn: amountIn,
                amountOutMinimum: amountOutMin,
                sqrtPriceLimitX96: 0
            })
        );
    }

    function _refundGasInBnb(address recipient, uint256 usdtAmount) internal {
        _safeApprove(USDT, address(V2_ROUTER), usdtAmount);
        address[] memory path = new address[](2);
        path[0] = USDT;
        path[1] = WBNB;

        // Use a small slippage tolerance for the gas refund (0.5 %)
        uint256[] memory expected = V2_ROUTER.getAmountsOut(usdtAmount, path);
        uint256 minBnb = (expected[1] * 9950) / 10000;

        uint256[] memory amounts = V2_ROUTER.swapExactTokensForETH(
            usdtAmount,
            minBnb,
            path,
            recipient,
            block.timestamp + 60
        );
        emit GasRefunded(recipient, usdtAmount, amounts[1]);
    }

    // ─── SafeERC20 helpers ───────────────────────────────────────────────────
    function _safeTransfer(address token, address to, uint256 value) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.transfer.selector, to, value)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "Transfer failed");
    }

    function _safeApprove(address token, address spender, uint256 value) internal {
        // Reset to 0 first for tokens that require it (USDT on BSC does)
        (bool success0, ) = token.call(
            abi.encodeWithSelector(IERC20.approve.selector, spender, 0)
        );
        require(success0, "Approve reset failed");

        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.approve.selector, spender, value)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "Approve failed");
    }

    // ─── Withdrawals ─────────────────────────────────────────────────────────
    function withdraw(address token, uint256 amount) external onlyOwner {
        _safeTransfer(token, owner, amount);
    }

    function withdrawAll(address token) external onlyOwner {
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal > 0) _safeTransfer(token, owner, bal);
    }

    function withdrawBNB() external onlyOwner {
        uint256 bal = address(this).balance;
        require(bal > 0, "No BNB");
        (bool ok, ) = owner.call{value: bal}("");
        require(ok, "BNB transfer failed");
    }

    // Accept any leftover BNB
    receive() external payable {}
} 
=======
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * PancakeSwap V2/V3 Flash-Loan Arbitrage Contract (hardened)
 * ──────────────────────────────────────────────────────────
 * Improvements over original:
 *  - ReentrancyGuard
 *  - Explicit slippage parameters (bps)
 *  - SafeERC20-style transfer/approve checks
 *  - Cleaner fee calculation + events
 *  - tokenOut removed (arb is always USDT <-> tokenIn)
 *  - Owner can still withdraw profits + adjust gas refund
 *
 * Deploy on BSC Mainnet (Remix or Foundry)
 * Compiler: 0.8.19+, Optimization: 200 runs
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

interface IPancakeV2Pair {
    function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external;
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 r0, uint112 r1, uint32 ts);
}

interface IPancakeV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

interface IPancakeV2Router {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function swapExactTokensForETH(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function getAmountsOut(uint amountIn, address[] calldata path)
        external view returns (uint[] memory amounts);
}

interface IPancakeV3Router {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external payable returns (uint256 amountOut);
}

contract PancakeArbFlashLoan {
    // ─── State ───────────────────────────────────────────────────────────────
    address public owner;
    uint256 public gasRefundUsdt = 5e17;          // 0.5 USDT (18 decimals)
    uint256 private constant REENTRANCY_NOT_ENTERED = 1;
    uint256 private constant REENTRANCY_ENTERED = 2;
    uint256 private _status;

    // BSC Mainnet
    IPancakeV2Factory public constant FACTORY =
        IPancakeV2Factory(0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73);
    IPancakeV2Router public constant V2_ROUTER =
        IPancakeV2Router(0x10ED43C718714eb63d5aA57B78B54704E256024E);
    IPancakeV3Router public constant V3_ROUTER =
        IPancakeV3Router(0x13f4EA83D0bd40E75C8222255bc855a974568Dd4);

    address public constant USDT = 0x55d398326f99059fF775485246999027B3197955;
    address public constant WBNB = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;

    // ─── Events ──────────────────────────────────────────────────────────────
    event ArbitrageExecuted(
        address indexed tokenIn,
        uint256 loanAmount,
        uint256 profit,
        bool v2First,
        uint24 v3Fee
    );
    event GasRefunded(address indexed recipient, uint256 usdtAmount, uint256 bnbReceived);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ─── Modifiers ───────────────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier nonReentrant() {
        require(_status != REENTRANCY_ENTERED, "ReentrancyGuard: reentrant call");
        _status = REENTRANCY_ENTERED;
        _;
        _status = REENTRANCY_NOT_ENTERED;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor() {
        owner = msg.sender;
        _status = REENTRANCY_NOT_ENTERED;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ─── Owner controls ──────────────────────────────────────────────────────
    function setGasRefundUsdt(uint256 amount) external onlyOwner {
        gasRefundUsdt = amount;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ─── Main entry point ────────────────────────────────────────────────────
    /**
     * @param tokenIn     Token to arb against USDT (e.g. WBNB)
     * @param loanAmount  USDT amount to flash-borrow (18 decimals)
     * @param v2First     true = buy on V2 → sell on V3; false = opposite
     * @param v3Fee       100 / 500 / 2500 / 10000
     * @param minProfit   Minimum net profit in USDT after fee + gas refund
     * @param slippageBps Max slippage in basis points (e.g. 50 = 0.5 %)
     */
    function executeArbitrage(
        address tokenIn,
        uint256 loanAmount,
        bool v2First,
        uint24 v3Fee,
        uint256 minProfit,
        uint256 slippageBps
    ) external onlyOwner nonReentrant {
        require(tokenIn != address(0) && tokenIn != USDT, "Bad tokenIn");
        require(loanAmount > 0, "Zero loan");
        require(slippageBps <= 500, "Slippage too high"); // safety cap 5 %

        address pair = FACTORY.getPair(USDT, tokenIn);
        require(pair != address(0), "No V2 pair");

        bytes memory data = abi.encode(
            tokenIn,
            loanAmount,
            v2First,
            v3Fee,
            minProfit,
            slippageBps,
            msg.sender
        );

        IPancakeV2Pair loanPair = IPancakeV2Pair(pair);
        address t0 = loanPair.token0();

        uint256 out0 = (t0 == USDT) ? loanAmount : 0;
        uint256 out1 = (t0 == USDT) ? 0 : loanAmount;

        loanPair.swap(out0, out1, address(this), data);
    }

    // ─── Pancake V2 flash-swap callback ──────────────────────────────────────
    function pancakeCall(
        address /*sender*/,
        uint256 /*amount0*/,
        uint256 /*amount1*/,
        bytes calldata data
    ) external nonReentrant {
        (
            address tokenIn,
            uint256 loanAmount,
            bool v2First,
            uint24 v3Fee,
            uint256 minProfit,
            uint256 slippageBps,
            address caller
        ) = abi.decode(data, (address, uint256, bool, uint24, uint256, uint256, address));

        // Security checks
        address pair = FACTORY.getPair(USDT, tokenIn);
        require(msg.sender == pair, "Unauthorized callback");
        require(caller == owner, "Not owner");

        uint256 startUsdt = IERC20(USDT).balanceOf(address(this));

        // ── Two-leg arbitrage ────────────────────────────────────────────────
        if (v2First) {
            // USDT → tokenIn on V2, then tokenIn → USDT on V3
            uint256 minOutV2 = _getMinOut(USDT, tokenIn, loanAmount, slippageBps);
            _swapV2(USDT, tokenIn, loanAmount, minOutV2);

            uint256 got = IERC20(tokenIn).balanceOf(address(this));
            uint256 minOutV3 = _getMinOut(tokenIn, USDT, got, slippageBps);
            _swapV3(tokenIn, USDT, got, v3Fee, minOutV3);
        } else {
            // USDT → tokenIn on V3, then tokenIn → USDT on V2
            uint256 minOutV3 = _getMinOut(USDT, tokenIn, loanAmount, slippageBps);
            _swapV3(USDT, tokenIn, loanAmount, v3Fee, minOutV3);

            uint256 got = IERC20(tokenIn).balanceOf(address(this));
            uint256 minOutV2 = _getMinOut(tokenIn, USDT, got, slippageBps);
            _swapV2(tokenIn, USDT, got, minOutV2);
        }

        uint256 endUsdt = IERC20(USDT).balanceOf(address(this));

        // Pancake V2 flash fee = 0.25 % → repay = loan * 10025 / 10000 (ceil)
        uint256 repay = (loanAmount * 10025 + 9999) / 10000; // ceiling division
        require(endUsdt >= repay + gasRefundUsdt + minProfit, "Insufficient profit");

        // Repay the pair
        _safeTransfer(USDT, msg.sender, repay);

        // Gas refund in BNB to the bot wallet
        if (gasRefundUsdt > 0) {
            _refundGasInBnb(caller, gasRefundUsdt);
        }

        uint256 profit = endUsdt - repay - gasRefundUsdt;
        emit ArbitrageExecuted(tokenIn, loanAmount, profit, v2First, v3Fee);
    }

    // ─── Internal helpers ────────────────────────────────────────────────────
    function _getMinOut(
        address from,
        address to,
        uint256 amountIn,
        uint256 slippageBps
    ) internal view returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = from;
        path[1] = to;
        uint256[] memory amounts = V2_ROUTER.getAmountsOut(amountIn, path);
        // Apply slippage: minOut = expected * (10000 - bps) / 10000
        return (amounts[1] * (10000 - slippageBps)) / 10000;
    }

    function _swapV2(
        address from,
        address to,
        uint256 amountIn,
        uint256 amountOutMin
    ) internal {
        _safeApprove(from, address(V2_ROUTER), amountIn);
        address[] memory path = new address[](2);
        path[0] = from;
        path[1] = to;
        V2_ROUTER.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            address(this),
            block.timestamp + 60
        );
    }

    function _swapV3(
        address from,
        address to,
        uint256 amountIn,
        uint24 fee,
        uint256 amountOutMin
    ) internal {
        _safeApprove(from, address(V3_ROUTER), amountIn);
        V3_ROUTER.exactInputSingle(
            IPancakeV3Router.ExactInputSingleParams({
                tokenIn: from,
                tokenOut: to,
                fee: fee,
                recipient: address(this),
                amountIn: amountIn,
                amountOutMinimum: amountOutMin,
                sqrtPriceLimitX96: 0
            })
        );
    }

    function _refundGasInBnb(address recipient, uint256 usdtAmount) internal {
        _safeApprove(USDT, address(V2_ROUTER), usdtAmount);
        address[] memory path = new address[](2);
        path[0] = USDT;
        path[1] = WBNB;

        // Use a small slippage tolerance for the gas refund (0.5 %)
        uint256[] memory expected = V2_ROUTER.getAmountsOut(usdtAmount, path);
        uint256 minBnb = (expected[1] * 9950) / 10000;

        uint256[] memory amounts = V2_ROUTER.swapExactTokensForETH(
            usdtAmount,
            minBnb,
            path,
            recipient,
            block.timestamp + 60
        );
        emit GasRefunded(recipient, usdtAmount, amounts[1]);
    }

    // ─── SafeERC20 helpers ───────────────────────────────────────────────────
    function _safeTransfer(address token, address to, uint256 value) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.transfer.selector, to, value)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "Transfer failed");
    }

    function _safeApprove(address token, address spender, uint256 value) internal {
        // Reset to 0 first for tokens that require it (USDT on BSC does)
        (bool success0, ) = token.call(
            abi.encodeWithSelector(IERC20.approve.selector, spender, 0)
        );
        require(success0, "Approve reset failed");

        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.approve.selector, spender, value)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "Approve failed");
    }

    // ─── Withdrawals ─────────────────────────────────────────────────────────
    function withdraw(address token, uint256 amount) external onlyOwner {
        _safeTransfer(token, owner, amount);
    }

    function withdrawAll(address token) external onlyOwner {
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal > 0) _safeTransfer(token, owner, bal);
    }

    function withdrawBNB() external onlyOwner {
        uint256 bal = address(this).balance;
        require(bal > 0, "No BNB");
        (bool ok, ) = owner.call{value: bal}("");
        require(ok, "BNB transfer failed");
    }

    // Accept any leftover BNB
    receive() external payable {}
}
>>>>>>> refs/remotes/origin/main
