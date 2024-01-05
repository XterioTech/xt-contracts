// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library BidHeap {
    struct Bid {
        uint256 id;
        address bidder;
        uint256 price;
        uint256 timestamp;
    }

    struct Heap {
        // These variables should never be directly accessed by users of the library: interactions must be restricted to
        // the library's function. As of Solidity v0.5.2, this cannot be enforced, though there is a proposal to add
        // this feature: see https://github.com/ethereum/solidity/issues/4637

        uint256 _maxCapacity;
        Bid[] _tree;
    }

    function initialize(Heap storage heap, uint256 cap) internal {
        require(heap._maxCapacity == 0, "BidHeap: duplicated initialize");
        heap._maxCapacity = cap;
    }

    function isFull(Heap storage heap) internal view returns (bool) {
        return heap._tree.length >= heap._maxCapacity;
    }

    function size(Heap storage heap) internal view returns (uint256) {
        return heap._tree.length;
    }

    function minBid(Heap storage heap) internal view returns (Bid memory) {
        require(heap._tree.length > 0, "BidHeap: heap is empty");
        return heap._tree[0];
    }

    function tryInsert(
        Heap storage heap,
        Bid memory newBid
    ) internal returns (bool) {
        if (isFull(heap)) {
            if (!isHigherOrEqualBid(newBid, heap._tree[0])) {
                return false;
            }
            heap._tree[0] = newBid;
            heapifyDown(heap, 0);
        } else {
            heap._tree.push(newBid);
            heapifyUp(heap, heap._tree.length - 1);
        }
        return true;
    }

    function heapifyUp(Heap storage heap, uint256 index) private {
        while (index > 0) {
            uint256 parentIndex = (index - 1) / 2;
            if (
                isHigherOrEqualBid(heap._tree[index], heap._tree[parentIndex])
            ) {
                break;
            }

            swap(heap, index, parentIndex);
            index = parentIndex;
        }
    }

    function heapifyDown(Heap storage heap, uint256 index) private {
        uint256 smallest = index;

        while (true) {
            uint256 leftChild = 2 * index + 1;
            uint256 rightChild = 2 * index + 2;
            if (
                leftChild < heap._tree.length &&
                isHigherOrEqualBid(heap._tree[smallest], heap._tree[leftChild])
            ) {
                smallest = leftChild;
            }
            if (
                rightChild < heap._tree.length &&
                isHigherOrEqualBid(heap._tree[smallest], heap._tree[rightChild])
            ) {
                smallest = rightChild;
            }
            if (smallest == index) {
                break;
            }
            swap(heap, smallest, index);
            index = smallest;
        }
    }

    function isHigherOrEqualBid(
        Bid memory _b1,
        Bid memory _b2
    ) internal pure returns (bool) {
        return
            _b1.price > _b2.price ||
            (_b1.price == _b2.price && _b1.id <= _b2.id);
    }

    function swap(Heap storage heap, uint256 index1, uint256 index2) private {
        Bid memory temp = heap._tree[index1];
        heap._tree[index1] = heap._tree[index2];
        heap._tree[index2] = temp;
    }
}
