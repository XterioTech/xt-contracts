// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MinHeap {
    uint private constant MAX_CAPACITY = 5;
    uint[] private heap;

    function insert(uint value) public {
        if (heap.length >= MAX_CAPACITY) {
            require(
                value > heap[0],
                "Heap is full, value to be inserted should larger than smallest"
            );
            heap[0] = value;
            heapifyDown(0);
        }

        heap.push(value);
        heapifyUp(heap.length - 1);
    }

    function getMin() public view returns (uint) {
        require(heap.length > 0, "Heap is empty");
        return heap[0];
    }

    function extractMin() public returns (uint) {
        require(heap.length > 0, "Heap is empty");

        uint root = heap[0];
        uint lastNode = heap[heap.length - 1];
        heap.pop();

        if (heap.length > 0) {
            heap[0] = lastNode;
            heapifyDown(0);
        }

        return root;
    }

    function heapifyUp(uint index) private {
        while (index > 0) {
            uint parentIndex = (index - 1) / 2;
            if (heap[index] >= heap[parentIndex]) {
                break;
            }

            (heap[index], heap[parentIndex]) = (heap[parentIndex], heap[index]);
            index = parentIndex;
        }
    }

    function heapifyDown(uint index) private {
        uint smallest = index;
        uint leftChild = 2 * index + 1;
        uint rightChild = 2 * index + 2;

        if (leftChild < heap.length && heap[leftChild] < heap[smallest]) {
            smallest = leftChild;
        }

        if (rightChild < heap.length && heap[rightChild] < heap[smallest]) {
            smallest = rightChild;
        }

        if (smallest != index) {
            (heap[index], heap[smallest]) = (heap[smallest], heap[index]);
            heapifyDown(smallest);
        }
    }
}
