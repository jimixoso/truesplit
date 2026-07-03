// Package sse implements a per-group broadcast hub for Server-Sent Events.
package sse

import "sync"

// Hub routes published messages to all active SSE subscribers for a group.
type Hub struct {
	mu      sync.RWMutex
	groups  map[string]map[chan []byte]struct{}
}

func NewHub() *Hub {
	return &Hub{groups: make(map[string]map[chan []byte]struct{})}
}

// Subscribe returns a channel that receives messages published to groupID.
// The caller must call Unsubscribe when the client disconnects.
func (h *Hub) Subscribe(groupID string) chan []byte {
	ch := make(chan []byte, 8)
	h.mu.Lock()
	if h.groups[groupID] == nil {
		h.groups[groupID] = make(map[chan []byte]struct{})
	}
	h.groups[groupID][ch] = struct{}{}
	h.mu.Unlock()
	return ch
}

// Unsubscribe removes ch from groupID's subscriber set and closes it.
func (h *Hub) Unsubscribe(groupID string, ch chan []byte) {
	h.mu.Lock()
	delete(h.groups[groupID], ch)
	if len(h.groups[groupID]) == 0 {
		delete(h.groups, groupID)
	}
	h.mu.Unlock()
	close(ch)
}

// Publish sends msg to every subscriber of groupID. Slow receivers are skipped
// (non-blocking send) to prevent one lagging client from stalling others.
func (h *Hub) Publish(groupID string, msg []byte) {
	h.mu.RLock()
	subs := h.groups[groupID]
	h.mu.RUnlock()
	for ch := range subs {
		select {
		case ch <- msg:
		default:
		}
	}
}
