// Singleton with helper methods for level entities
define([
    'ash',
    'game/constants/WorldCreatorConstants',
    'game/nodes/LevelNode',
    'game/nodes/sector/SectorNode',
    'game/components/common/PositionComponent',
    'game/components/sector/SectorStatusComponent',
    'game/components/sector/SectorLocalesComponent',
    'game/components/sector/SectorFeaturesComponent',
    'game/components/sector/SectorControlComponent',
    'game/components/level/LevelPassagesComponent',
    'game/vos/LevelProjectVO',
    'game/vos/ImprovementVO',
], function (
	Ash,
	WorldCreatorConstants,
	LevelNode, SectorNode,
	PositionComponent,
	SectorStatusComponent,
	SectorLocalesComponent,
	SectorFeaturesComponent,
	SectorControlComponent,
	LevelPassagesComponent,
	LevelProjectVO,
	ImprovementVO
) {
    var LevelHelper = Ash.Class.extend({
        
		engine: null,
		levelNodes: null,
		sectorNodes: null,
		
		playerActionsHelper: null,
		
		constructor: function (engine, gameState, playerActionsHelper) {
			this.engine = engine;
			this.gameState = gameState;
			this.playerActionsHelper = playerActionsHelper;
			this.levelNodes = engine.getNodeList(LevelNode);
			this.sectorNodes = engine.getNodeList(SectorNode);
		},
		
		getLevelEntityForSector: function (sectorEntity) {
			var levelPosition;
			var sectorPosition = sectorEntity.get(PositionComponent);
			for (var node = this.levelNodes.head; node; node = node.next) {
				levelPosition = node.entity.get(PositionComponent);
				if (levelPosition.level === sectorPosition.level) return node.entity;
			}
			console.log("WARN: No level entity found for sector with position " + sectorPosition);
			return null;
		},
		
		getSectorByPosition: function (level, sector) {
			var sectorPosition;
			for (var node = this.sectorNodes.head; node; node = node.next) {
				sectorPosition = node.entity.get(PositionComponent);
				if (sectorPosition.level == level && sectorPosition.sector == sector) return node.entity;
			}
			console.log("WARN:: No sector entity found for position " + level + "-" + sector);
			return null;
		},
		
		getAvailableProjectsForCamp: function (sectorEntity, playerActions) {
			var projects = [];
			
			var campLevelEntity = this.getLevelEntityForSector(sectorEntity); // use to get projects only for that level
			
			// get all levels
			for (var node = this.levelNodes.head; node; node = node.next) {
				projects = projects.concat(this.getAvailableProjectsForLevel(node.entity, playerActions));
			}
			
			// sort by level ordinal
			var gameState = this.gameState;
			projects.sort(function (a, b) {
				var levelOrdinalA = gameState.getLevelOrdinal(a.level);
				var levelOrdinalB = gameState.getLevelOrdinal(b.level);
				return levelOrdinalA - levelOrdinalB;
			});
			
			// filter duplicates (corresponding up and down)
			var projectsFiltered = [];
			var project;
			var projectExists;
			var existingProject;
			for (var i = 0; i < projects.length; i++) {
				project = projects[i];
				projectExists = false;
				for (var j = 0; j < projectsFiltered.length; j++) {
					existingProject = projectsFiltered[j];
					if (existingProject.sector === project.sector && (existingProject.level - 1 === project.level || existingProject.level + 1 === project.level)) {
						projectExists = true;
						break;
					}
				}
				if (!projectExists) projectsFiltered.push(project);
			}
			
			return projectsFiltered;
		},
		
		getAvailableProjectsForLevel: function (levelEntity, playerActions) {
			var projects = [];
			var level = levelEntity.get(PositionComponent).level;
			var levelPassagesComponent = levelEntity.get(LevelPassagesComponent);
			
			// TODO check if the levelPassagesComponent + system are needed if we need the sector entity anyway
			
			if (levelPassagesComponent) {
				var sectorEntity;
				var sectorEntityS;
				var statusComponent;
				var scouted;
				var passage;
				for (var s = WorldCreatorConstants.FIRST_SECTOR; s <= WorldCreatorConstants.LAST_SECTOR; s++) {
					sectorEntity = this.getSectorByPosition(level, s);
					statusComponent = sectorEntity.get(SectorStatusComponent);
					scouted = statusComponent && statusComponent.scouted;
					if (scouted) {
						var improvementName = "";
						var actionName = "";
						if (levelPassagesComponent.passagesUp[s] && !levelPassagesComponent.passagesUpBuilt[s]) {
							switch (levelPassagesComponent.passagesUp[s].type) {
								case 1:
									improvementName = improvementNames.passageUpHole;
									actionName = "build_out_passage_up_hole";
									break;
								case 2:
									improvementName = improvementNames.passageUpElevator;
									actionName = "build_out_passage_up_elevator";
									break;
								case 3:
									improvementName = improvementNames.passageUpStairs;
									actionName = "build_out_passage_up_stairs";
									break;
							}
							if (this.playerActionsHelper.checkRequirements(actionName, false, sectorEntity).value > 0)
								projects.push(new LevelProjectVO(new ImprovementVO(improvementName), actionName, level, s));
						}
						if (levelPassagesComponent.passagesDown[s] && !levelPassagesComponent.passagesDownBuilt[s]) {
							switch (levelPassagesComponent.passagesDown[s].type) {
								case 1:
									improvementName = improvementNames.passageDownHole;
									actionName = "build_out_passage_down_hole";
									break;
								case 2:
									improvementName = improvementNames.passageDownElevator;
									actionName = "build_out_passage_down_elevator";
									break;
								case 3:
									improvementName = improvementNames.passageDownStairs;
									actionName = "build_out_passage_down_stairs";
									break;
							}
							if (this.playerActionsHelper.checkRequirements(actionName, false, sectorEntity).value > 0)
								projects.push(new LevelProjectVO(new ImprovementVO(improvementName), actionName, level, s));
						}
					}
				}
			}
			
			return projects;
		},
		
        getLevelClearedWorkshopCount: function (level, resourceName) {
			var count = 0;
            var featuresComponent;
            var sectorControlComponent;
            for (var node = this.sectorNodes.head; node; node = node.next) {
                if (node.entity.get(PositionComponent).level === level)
                {
                    featuresComponent = node.entity.get(SectorFeaturesComponent);
                    sectorControlComponent = node.entity.get(SectorControlComponent);
                    if (featuresComponent.getWorkshopResource() === resourceName) {
                        if (sectorControlComponent && sectorControlComponent.hasControl()) {
                            count++;
                        }
                    }
                }
            }
            return count;
        },
		
		getLevelLocales: function (level, includeScouted, excludeLocaleVO) {
			var locales = [];
			var sectorPosition;
			for (var node = this.sectorNodes.head; node; node = node.next) {
				sectorPosition = node.entity.get(PositionComponent);
				if (sectorPosition.level === level) {
					var sectorLocalesComponent = node.entity.get(SectorLocalesComponent);
					var sectorStatus = node.entity.get(SectorStatusComponent);
					var locale;
					for (var i = 0; i < sectorLocalesComponent.locales.length; i++) {
						locale = sectorLocalesComponent.locales[i];
						if (locale !== excludeLocaleVO && (includeScouted || !sectorStatus.isLocaleScouted(i)))
							locales.push(locale);
					}
				}
			}
			return locales;
		},
    });
    
    return LevelHelper;
});