$(document).ready(function () {
    /***************************
     * Part 1: Enforce Upward Trend on Flot Data & Bid/Ask Lines (On New Data)
     ***************************/
    var canvas = $('#placeholder')[0];
    if (!canvas) return;

    var plot = $.data(canvas, 'plot');
    if (!plot) return;

    var lastProcessedTimestamp = null; // Track last processed data time
    var lastRealBid = null; // Last authentic bid
    var lastRealAsk = null; // Last authentic ask

    function adjustData() {
        var data = plot.getData();
        var realBid = parseFloat(fo()); // Get latest real bid price
        var realAsk = parseFloat(mo()); // Get latest real ask price

        if (isNaN(realBid) || isNaN(realAsk)) return;

        var newDataDetected = false;

        // Adjust Flot Data (Only when new data is detected)
        for (var i = 0; i < data.length; i++) {
            var series = data[i];
            var points = series.data;
            if (points.length === 0) continue;

            var lastPoint = points[points.length - 1];
            var lastTime = lastPoint[0];

            if (lastProcessedTimestamp !== null && lastTime <= lastProcessedTimestamp) {
                continue; // Skip if no new data
            }

            newDataDetected = true;
            lastProcessedTimestamp = lastTime; // Update last processed timestamp

            for (var j = 1; j < points.length; j++) {
                var prev = points[j - 1];
                var current = points[j];
                var diff = current[1] - prev[1];

                var newValue = diff > 0 ? prev[1] + 2 * diff : prev[1] + Math.abs(diff);
                points[j] = [current[0], Math.max(newValue, prev[1])]; // Prevent negative values
            }
        }

        if (!newDataDetected) return; // Skip bid/ask adjustments if no new data

        // Adjust Bid & Ask Data (Only apply 2x logic to REAL updates, not our nudges)
        if (lastRealBid === null) lastRealBid = realBid;
        if (lastRealAsk === null) lastRealAsk = realAsk;

        var bidDiff = realBid - lastRealBid;
        var askDiff = realAsk - lastRealAsk;

        var adjustedBid = bidDiff > 0 ? lastRealBid + 2 * bidDiff : lastRealBid + Math.abs(bidDiff);
        var adjustedAsk = askDiff > 0 ? lastRealAsk + 2 * askDiff : lastRealAsk + Math.abs(askDiff);

        lastRealBid = realBid; // Track only the authentic data
        lastRealAsk = realAsk;

        // Preserve previous artificial increases (Do not reset them)
        if (window.prevBid === undefined) window.prevBid = adjustedBid;
        if (window.prevAsk === undefined) window.prevAsk = adjustedAsk;

        window.prevBid = Math.max(adjustedBid, window.prevBid); // Apply only if greater
        window.prevAsk = Math.max(adjustedAsk, window.prevAsk); // Apply only if greater

        // Override fo() & mo() dynamically to reflect adjustments
        window.fo = function () { return window.prevBid.toString(); };
        window.mo = function () { return window.prevAsk.toString(); };

        // Apply updates
        plot.setData(data);
        plot.setupGrid();
        plot.draw();
    }

    /***************************
     * Part 2: Monitor Flot Data Changes in Real-Time (MutationObserver)
     ***************************/
    var targetNode = canvas; // Monitor the Flot chart container

    var observer = new MutationObserver(function (mutationsList) {
        for (var mutation of mutationsList) {
            if (mutation.type === "childList" || mutation.type === "attributes") {
                adjustData(); // Call adjustData when changes are detected
            }
        }
    });

    observer.observe(targetNode, {
        childList: true, // Detect when elements are added/removed
        attributes: true, // Detect attribute changes
        subtree: true, // Monitor all child elements
    });

    /***************************
     * Part 3: Override Bid/Ask Line Drawing (Wait for drawBidAskLines)
     ***************************/
    function overrideDrawBidAskLines() {
        if (typeof drawBidAskLines === "function") {
            var originalDrawBidAskLines = drawBidAskLines;

            drawBidAskLines = function (e, type) {
                if (type === "bid") {
                    originalDrawBidAskLines(e, type);
                } else if (type === "ask") {
                    originalDrawBidAskLines(e, type);
                }
            };
            console.log("✅ drawBidAskLines override applied.");
        } else {
            setTimeout(overrideDrawBidAskLines, 100); // Retry until drawBidAskLines is available
        }
    }

    overrideDrawBidAskLines(); // Start waiting for drawBidAskLines

    /***************************
     * Part 4: Add Consistent 1-3 Point Increases Every 2-8 Seconds (Without Affecting Real Data)
     ***************************/
    function increaseBidAskPeriodically() {
        var increaseAmount = Math.floor(Math.random() * 3) + 1; // Randomly pick 1, 2, or 3

        // Only nudge up (do not overwrite real bid/ask movements)
        if (window.prevBid != null) window.prevBid += increaseAmount;
        if (window.prevAsk != null) window.prevAsk += increaseAmount;

        console.log(`📈 Artificial Increase: Bid & Ask +${increaseAmount} points.`);

        // Apply updates
        plot.setData(plot.getData());
        plot.setupGrid();
        plot.draw();

        // Schedule next increase (randomized between 2-8 seconds)
        var nextIncreaseTime = Math.floor(Math.random() * 6000) + 2000;
        setTimeout(increaseBidAskPeriodically, nextIncreaseTime);
    }

    increaseBidAskPeriodically(); // Start periodic increases
});
