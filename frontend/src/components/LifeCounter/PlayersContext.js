import { createContext, useContext } from 'react';

// The live players array, provided by LifeCounter around the player grid.
//
// PlayerAdvancedControls needs the full player list (commander damage source
// picker), but passing `players` as a prop through PlayerCard would change
// identity on every state change and defeat React.memo on the card. Only the
// advanced-controls modal consumes this, and it only exists while open, so
// re-rendering it on each change is correct (it shows live values) and cheap.
const PlayersContext = createContext([]);

export function usePlayers() {
  return useContext(PlayersContext);
}

export default PlayersContext;
