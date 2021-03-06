// Helper methods related to player actions (costs, requirements, descriptions) - common definitions for all actions
define([
    'ash',
    'game/constants/PlayerActionConstants',
    'game/constants/LocaleConstants',
    'game/constants/FightConstants',
    'game/components/sector/EnemiesComponent',
    'game/components/sector/SectorControlComponent',
    'game/components/sector/FightComponent',
    'game/components/sector/FightEncounterComponent',
    'game/nodes/PlayerLocationNode',
    'game/nodes/player/PlayerStatsNode',
    'game/systems/FaintingSystem',
    'game/systems/SaveSystem'
], function (
	Ash, PlayerActionConstants, LocaleConstants, FightConstants, 
    EnemiesComponent, SectorControlComponent, FightComponent, FightEncounterComponent, 
    PlayerLocationNode, PlayerStatsNode, 
    FaintingSystem, SaveSystem
) {
    var FightHelper = Ash.Class.extend({
		
		uiFunctions: null,
		playerActionsHelper: null,
        playerActionResultsHelper: null,
		
		playerLocationNodes: null,
        playerStatsNodes: null,
		
		pendingEnemies: 0,
		pendingWinCallback: null,
		pendingFleeCallback: null,
		pendingLoseCallback: null,
		
		constructor: function (engine, playerActionsHelper, playerActionResultsHelper) {
			this.playerActionsHelper = playerActionsHelper;
            this.playerActionResultsHelper = playerActionResultsHelper;
			this.engine = engine;
            this.playerLocationNodes = engine.getNodeList(PlayerLocationNode);
            this.playerStatsNodes = engine.getNodeList(PlayerStatsNode);
		},

		handleRandomEncounter: function (action, winCallback, fleeCallback, loseCallback) {			
			var baseActionID = this.playerActionsHelper.getBaseActionID(action);
			var hasEnemies = this.hasEnemiesCurrentLocation(action);
			if (hasEnemies) {
                var vision = this.playerStatsNodes.head.vision.value;
				var encounterProbability = PlayerActionConstants.getRandomEncounterProbability(baseActionID, vision);
				if (Math.random() < encounterProbability) {
					this.pendingEnemies = this.getEnemyCount(action);
					this.pendingWinCallback = winCallback;
					this.pendingFleeCallback = fleeCallback;
					this.pendingLoseCallback = loseCallback;
					this.initFight(action);
					return;
				}
			}

			winCallback();
		},
        
        hasEnemiesCurrentLocation: function(action) {
            if (!this.playerLocationNodes.head)
                return false;
            var baseActionID = this.playerActionsHelper.getBaseActionID(action); 
            var localeId = FightConstants.getEnemyLocaleId(baseActionID, action);    
            var enemiesComponent = this.playerLocationNodes.head.entity.get(EnemiesComponent);     
            var sectorControlComponent = this.playerLocationNodes.head.entity.get(SectorControlComponent);
            return enemiesComponent.hasEnemies() && !sectorControlComponent.hasControlOfLocale(localeId);
        },
        
        initFight: function (action) {
			console.log("init fight " + action + " " + this.pendingEnemies);
            var sector = this.playerLocationNodes.head.entity;
            sector.remove(FightComponent);
			
            var enemiesComponent = sector.get(EnemiesComponent);
            enemiesComponent.selectNextEnemy();
			sector.add(new FightEncounterComponent(enemiesComponent.getNextEnemy(), action));
			this.uiFunctions.showFight();
        },
        
        startFight: function () {
            // TODO move to PlayerActionFunctions
            if (this.playerActionsHelper.checkAvailability("fight", true)) {
                this.playerActionsHelper.deductCosts("fight");
                var sector = this.playerLocationNodes.head.entity;
				var encounterComponent = sector.get(FightEncounterComponent);
				if (encounterComponent && encounterComponent.enemy) {
					sector.add(new FightComponent(encounterComponent.enemy));
				} else {
					console.log("WARN: Encounter or enemy not initialized - cannot start fight.");
				}
            }
        },
        
        endFight: function () {
            var sector = this.playerLocationNodes.head.entity;
			var encounterComponent = sector.get(FightEncounterComponent);
            if (sector.has(FightComponent)) {
                var fightComponent = sector.get(FightComponent);
				if (fightComponent.won) {
					sector.get(EnemiesComponent).resetNextEnemy();
					this.pendingEnemies--;
					if (this.pendingEnemies > 0) {
						this.initFight(encounterComponent.context);
						return;
					}
					if (this.pendingWinCallback) {
                        this.playerActionResultsHelper.collectRewards(false, fightComponent.resultVO);
                        this.pendingWinCallback();
                    }
				} else {
					if (this.pendingLoseCallback) this.pendingLoseCallback();
					this.engine.getSystem(FaintingSystem).fadeOutToLastVisitedCamp(false, false);
				}
            } else {
				if (this.pendingFleeCallback) this.pendingFleeCallback();
			}
			
            this.uiFunctions.popupManager.closePopup("fight-popup");
            sector.remove(FightComponent);
			this.pendingWinCallback = null;
			this.pendingFleeCallback = null;
			this.pendingLoseCallback = null;
            this.save();
        },
		
		getEnemyCount: function (action) {
			var sectorControlComponent = this.playerLocationNodes.head.entity.get(SectorControlComponent);
			var baseActionID = this.playerActionsHelper.getBaseActionID(action);
			var localeId = FightConstants.getEnemyLocaleId(baseActionID, action);
			switch (baseActionID) {
				case "clear_workshop":
				case "fight_gang":
					return sectorControlComponent.getCurrentEnemies(localeId);
				default: return 1;
			}
		},
        
        save: function () {
            var saveSystem = this.engine.getSystem(SaveSystem);
            saveSystem.save();
        },
        
    });

    return FightHelper;
});