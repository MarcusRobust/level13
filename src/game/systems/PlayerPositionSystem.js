// A system that saves the player's current location (level&sector) based on their PositionComponent
// and handles updating sector components related to the player's position
define([
    'ash',
    'game/GlobalSignals',
    'game/constants/UIConstants',
    'game/constants/WorldCreatorConstants',
    'game/nodes/PlayerPositionNode',
    'game/nodes/level/LevelNode',
    'game/nodes/PlayerLocationNode',
    'game/nodes/sector/SectorNode',
    'game/nodes/sector/CampNode',
    'game/components/common/CurrentPlayerLocationComponent',
    'game/components/sector/CurrentNearestCampComponent',
    'game/components/common/PositionComponent',
    'game/components/common/VisitedComponent',
    'game/components/common/RevealedComponent',
    'game/components/common/CampComponent',
], function (Ash, GlobalSignals, UIConstants, WorldCreatorConstants,
    PlayerPositionNode, LevelNode, PlayerLocationNode, SectorNode, CampNode,
	CurrentPlayerLocationComponent, CurrentNearestCampComponent, PositionComponent,
	VisitedComponent, RevealedComponent, CampComponent) {
    
    var PlayerPositionSystem = Ash.System.extend({
	    
		gameState: null,
		levelHelper: null,
		uiFunctions: null,
		occurrenceFunctions: null,
		
		sectorNodes: null,
		levelNodes: null,
		playerPositionNodes: null,
		playerLocationNodes: null,
        
        lastUpdatePosition: null,
		
		constructor: function (gameState, levelHelper, uiFunctions, occurrenceFunctions) {
			this.gameState = gameState;
            this.levelHelper = levelHelper;
			this.uiFunctions = uiFunctions;
			this.occurrenceFunctions = occurrenceFunctions;
		},
	
		addToEngine: function (engine) {
			this.sectorNodes = engine.getNodeList(SectorNode);
			this.levelNodes = engine.getNodeList(LevelNode);
			this.playerPositionNodes = engine.getNodeList(PlayerPositionNode);
			this.playerLocationNodes = engine.getNodeList(PlayerLocationNode);
            this.campNodes = engine.getNodeList(CampNode);
            
            var sys = this;
            this.playerPositionNodes.nodeAdded.addOnce(function(node) {
                sys.lastUpdatePosition = null;
            });
            this.campNodes.nodeAdded.addOnce(function (node) {
                sys.lastUpdatePosition = null;
            });
            this.playerLocationNodes.nodeAdded.addOnce(function (node) {
                sys.handleNewSector(node, node.entity.get(PositionComponent).sectorId());
            });
		},
	
		removeFromEngine: function (engine) {
			this.sectorNodes = null;
			this.levelNodes = null;
			this.playerPositionNodes = null;
			this.playerLocationNodes = null;
		},
	
		update: function (time) {
            var playerPos = this.playerPositionNodes.head.position;
            if (!this.lastUpdatePosition || !this.lastUpdatePosition.equals(playerPos)) {
                this.updateLevelEntities();
                this.updateSectors();
                this.lastUpdatePosition = playerPos.clone();
            }
		},
        
        updateLevelEntities: function() {
            var playerPos = this.playerPositionNodes.head.position;
            var levelpos;
            for (var levelNode = this.levelNodes.head; levelNode; levelNode = levelNode.next) {
                levelpos = levelNode.level.position;
                if (levelpos == playerPos.level && !levelNode.entity.has(CurrentPlayerLocationComponent)) {
                    levelNode.entity.add(new CurrentPlayerLocationComponent());
                    if (!levelNode.entity.has(VisitedComponent)) {
                        this.handleNewLevel(levelNode, levelpos);
                    } else {
                        this.handleEnterLevel(levelNode, levelpos);
                    }
                } else if (levelpos != playerPos.level && levelNode.entity.has(CurrentPlayerLocationComponent)) {
                    levelNode.entity.remove(CurrentPlayerLocationComponent);
                }
            }
        },
        
        updateSectors: function() {
            var playerPos = this.playerPositionNodes.head.position; 
            var playerSectorFound = false;
            
            var sectorPos;
            var hasLocationComponent;
            var hasCurrentCampComponent;
            var hasCamp;
            for (var sectorNode = this.sectorNodes.head; sectorNode; sectorNode = sectorNode.next) {
                levelpos = sectorNode.entity.get(PositionComponent).level;
                sectorPos = sectorNode.entity.get(PositionComponent).sectorId();
                hasLocationComponent = sectorNode.entity.has(CurrentPlayerLocationComponent);
                hasCurrentCampComponent = sectorNode.entity.has(CurrentNearestCampComponent);
                hasCamp = sectorNode.entity.has(CampComponent);

                if (levelpos === playerPos.level && sectorPos === playerPos.sectorId()) {
                    playerSectorFound = true;
                }

                if (hasCamp && levelpos === playerPos.level && !hasCurrentCampComponent) {
                    sectorNode.entity.add(new CurrentNearestCampComponent());
                } else if (hasCamp && levelpos !== playerPos.level && hasCurrentCampComponent) {
                    sectorNode.entity.remove(CurrentNearestCampComponent);
                }
                if (levelpos === playerPos.level && sectorPos === playerPos.sectorId() && !hasLocationComponent) {
                    if (this.playerLocationNodes.head)
                        this.playerLocationNodes.head.entity.remove(CurrentPlayerLocationComponent);
                    sectorNode.entity.add(new CurrentPlayerLocationComponent());
                    if (!sectorNode.entity.has(VisitedComponent)) {
                        this.handleNewSector(sectorNode, sectorPos);
                    }
                    GlobalSignals.playerMovedSignal.dispatch(playerPos);
                    this.uiFunctions.onPlayerMoved();
                } else if ((levelpos !== playerPos.level || sectorPos !== playerPos.sectorId()) && hasLocationComponent) {
                    sectorNode.entity.remove(CurrentPlayerLocationComponent);
                }
            }

            if (!playerSectorFound) {
                this.handleInvalidPosition();
            }
        },
		
		handleNewLevel: function (levelNode, levelPos) {
			levelNode.entity.add(new VisitedComponent());
			levelNode.entity.add(new RevealedComponent());
            var levelOrdinal = this.gameState.getLevelOrdinal(levelPos);
            this.gameState.level = Math.max(this.gameState.level, levelOrdinal);
			if (levelPos !== 13) this.gameState.unlockedFeatures.levels = true;
			if (levelPos === this.gameState.getGroundLevel()) this.gameState.unlockedFeatures.favour = true;
		},
        
        handleEnterLevel: function (levelNode, levelPos) {
			this.occurrenceFunctions.onEnterLevel(levelNode.entity);
        },
		
		handleNewSector: function (sectorNode) {
			
			sectorNode.entity.add(new VisitedComponent());
			sectorNode.entity.add(new RevealedComponent());
            
            var sectorPosition = sectorNode.entity.get(PositionComponent);
            var revealDiameter = 1;
            
            var revealedNeighbour;
            for (var dx = -revealDiameter; dx <= revealDiameter; dx++) {
                for (var dy = -revealDiameter; dy <= revealDiameter; dy++) {
                    revealedNeighbour = this.levelHelper.getSectorByPosition(sectorPosition.level, sectorPosition.sectorX + dx, sectorPosition.sectorY + dy);
                    if (revealedNeighbour && !revealedNeighbour.has(RevealedComponent)) {
                        revealedNeighbour.add(new RevealedComponent());
                    }
                }
            }
            
            this.gameState.numVisitedSectors++;
			this.gameState.unlockedFeatures.sectors = true;            
			this.occurrenceFunctions.onEnterNewSector(sectorNode.entity);
		},
        
        handleInvalidPosition: function () {
            var playerPos = this.playerPositionNodes.head.position; 
            console.log("WARN: Player location could not be found (" + playerPos.level + "." + playerPos.sectorId() + ").");
            console.log("WARN: Moving to a known valid position.");
            playerPos.level = 13;
            playerPos.sectorX = WorldCreatorConstants.FIRST_CAMP_X;
            playerPos.sectorY = WorldCreatorConstants.FIRST_CAMP_Y;
            playerPos.inCamp = false;
            this.lastUpdatePosition = null;
        },
        
    });

    return PlayerPositionSystem;
});
