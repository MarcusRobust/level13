define([
    'ash',
    'game/GlobalSignals',
    'game/constants/UIConstants',
    'game/constants/ItemConstants',
    'game/constants/BagConstants',
    'game/nodes/PlayerPositionNode',
    'game/nodes/PlayerLocationNode',
    'game/components/player/BagComponent',
    'game/components/player/ItemsComponent',
    'game/components/common/CampComponent',
], function (
    Ash, GlobalSignals, UIConstants, ItemConstants, BagConstants,
    PlayerPositionNode, PlayerLocationNode,
    BagComponent, ItemsComponent, CampComponent
) {
    var UIOutEmbarkSystem = Ash.System.extend({
	
		uiFunctions : null,
		gameState : null,
		resourcesHelper: null,
        levelHelper: null,
		
		engine: null,
		
		playerPosNodes: null,
		playerLocationNodes: null,
	
		constructor: function (uiFunctions, gameState, resourceHelper) {
			this.uiFunctions = uiFunctions;
			this.gameState = gameState;
			this.resourcesHelper = resourceHelper;
			return this;
		},
	
		addToEngine: function (engine) {
			this.playerPosNodes = engine.getNodeList(PlayerPositionNode);
			this.playerLocationNodes = engine.getNodeList(PlayerLocationNode);
			
			this.initListeners();
			
			this.engine  = engine;
		},

		removeFromEngine: function (engine) {
			this.playerPosNodes = null;
			this.playerLocationNodes = null;
			this.engine = null;
		},
	
		initListeners: function () {
			var sys = this;
            GlobalSignals.tabChangedSignal.add(function () {
                sys.regenrateEmbarkItems();
            });
		},
		
		initLeaveCampRes: function () {
			if (this.gameState.uiStatus.leaveCampRes) {
				var campResources = this.resourcesHelper.getCurrentStorage();
				for (var key in resourceNames) {
					var name = resourceNames[key];
					var oldVal = this.gameState.uiStatus.leaveCampRes[name];
					var campVal = campResources.resources.getResource(name);
					if (oldVal && oldVal > 0) {
						var value = Math.floor(Math.min(oldVal, campVal));
						$("#stepper-embark-" + name + " input").val(value);
					}
				}
			}
		},
        
        initLeaveCampItems: function () {
			if (this.gameState.uiStatus.leaveCampItems) {
                var itemsComponent = this.playerPosNodes.head.entity.get(ItemsComponent);
				for (var key in this.gameState.uiStatus.leaveCampItems) {
					var itemID = key;
					var oldVal = this.gameState.uiStatus.leaveCampItems[itemID];
					var ownedCount = itemsComponent.getCountById(itemID, true);
					if (oldVal && oldVal > 0) {
						var value = Math.floor(Math.min(oldVal, ownedCount));
						$("#stepper-embark-" + itemID + " input").val(value);
					}
				}
			}
        },
		
		update: function (time) {
			if (this.gameState.uiStatus.currentTab !== this.uiFunctions.elementIDs.tabs.out) {
				this.refreshedEmbark = false;
				return;
			}
			
			var posComponent = this.playerPosNodes.head.position;
            
            if (!this.playerLocationNodes.head) {
                return;
            }
			
            // TODO create nice transitions for leaving camp
			this.uiFunctions.toggle("#container-tab-enter-out", posComponent.inCamp);
			this.uiFunctions.toggle("#container-tab-two-out", !posComponent.inCamp);
			this.uiFunctions.toggle("#container-tab-two-out-actions", !posComponent.inCamp);
			
			if (posComponent.inCamp) {
				if (!this.refreshedEmbark) {
					this.initLeaveCampRes();
                    this.initLeaveCampItems();
				}
				this.updateEmbarkPage();
				this.refreshedEmbark = true;
			}
		},
		
		updateEmbarkPage: function () {
			$("#tab-header h2").text("Leave camp");
            
			var campResources = this.resourcesHelper.getCurrentStorage();
            var campResourcesAcc = this.resourcesHelper.getCurrentStorageAccumulation(false);
            var bagComponent = this.playerPosNodes.head.entity.get(BagComponent);
            var selectedCapacity = 0;
			var selectedAmount;
            
            var selectedWater = 0;
            var selectedFood = 0;
            
            var uiFunctions = this.uiFunctions;
            
			// Resource steppers
			$.each($("#embark-resources tr"), function () {
				var resourceName = $(this).attr("id").split("-")[2];
				var campVal = campResources.resources.getResource(resourceName);
				var visible = campVal > 0;
				var inputMax = Math.min(Math.floor(campVal));
				uiFunctions.toggle($(this), visible);
				$(this).children("td").children(".stepper").children("input").attr("max", inputMax);
                selectedAmount = Math.max(0, $(this).children("td").children(".stepper").children("input").val());
                selectedCapacity += selectedAmount * BagConstants.getResourceCapacity(resourceName);
                
                if (resourceName === resourceNames.water)
                    selectedWater = selectedAmount;
                if (resourceName === resourceNames.food)
                    selectedFood = selectedAmount;
			});
            
            // Items steppers
            var itemsComponent = this.playerPosNodes.head.entity.get(ItemsComponent);
            var visibleItemTRs = 0;
			$.each($("#embark-items tr"), function () {
				var itemID = $(this).attr("id").split("-")[2];
                var count = itemsComponent.getCountById(itemID, true);
				var visible = count > 0;
                if (visible) visibleItemTRs++;
				var inputMax = Math.min(Math.floor(count));
                var inputMin = 0;
                var inputValue = $(this).children("td").children(".stepper").children("input").attr("value");
				uiFunctions.toggle($(this), visible);
				$(this).children("td").children(".stepper").children("input").attr("max", inputMax);
				$(this).children("td").children(".stepper").children("input").attr("min", inputMin);
				$(this).children("td").children(".stepper").children("input").attr("value", Math.max(inputValue, inputMin));
                selectedAmount = Math.max(0, $(this).children("td").children(".stepper").children("input").val());
                selectedCapacity += selectedAmount * BagConstants.getItemCapacity(itemsComponent.getItem(itemID));
			});
			
            this.uiFunctions.toggle("#embark-items-container", visibleItemTRs > 0);
            
            bagComponent.selectedCapacity = selectedCapacity;
			$("#embark-bag .value").text(UIConstants.roundValue(bagComponent.selectedCapacity), true, true);
			$("#embark-bag .value-total").text(bagComponent.totalCapacity);
            
            var warning = "";
            var campPopulation = Math.floor(this.playerLocationNodes.head.entity.get(CampComponent).population);
            if (campPopulation > 1) {
                var remainingWater = campResources.resources.getResource(resourceNames.water) - selectedWater;
                var remainingFood = campResources.resources.getResource(resourceNames.food) - selectedFood;
                var isWaterDecreasing = campResourcesAcc.resourceChange.getResource(resourceNames.water) < 0;
                var isFoodDecreasing = campResourcesAcc.resourceChange.getResource(resourceNames.food) < 0;
                if (isWaterDecreasing && selectedWater > 0 && remainingWater <= campPopulation) {
                    warning = "There won't be much water left in the camp.";
                }
                else if (isFoodDecreasing && selectedFood > 0 && remainingFood <= campPopulation) {
                    warning = "There won't be much food left in the camp.";
                }
            }
            $("#embark-warning").text(warning);
            this.uiFunctions.toggle("#embark-warning", warning.length > 0);
		},
        
        regenrateEmbarkItems: function () {
            $("#embark-items").empty();
            var itemsComponent = this.playerPosNodes.head.entity.get(ItemsComponent);
            var uniqueItems = itemsComponent.getUnique(true);
			uniqueItems = uniqueItems.sort(UIConstants.sortItemsByType);
            for (var i = 0; i < uniqueItems.length; i++) {
                var item = uniqueItems[i];
                if (item.type === ItemConstants.itemTypes.uniqueEquipment) continue;
                if (item.type === ItemConstants.itemTypes.follower) continue;
                if (item.type === ItemConstants.itemTypes.artefact) continue;
                if (item.type === ItemConstants.itemTypes.note) continue;
                
                var count = itemsComponent.getCountById(item.id, true);
                var showCount = item.equipped ? count - 1 : count;
                if (item.equipped && count === 1) continue;
                
                $("#embark-items").append(
                    "<tr id='embark-assign-" + item.id + "'>" +
                    "<td><img src='" + item.icon + "'/>" + item.name + "</td>" +
                    "<td><div class='stepper' id='stepper-embark-" + item.id + "'></div></td>" +
                    "<td class='list-amount'> / " + showCount + "</div></td>" +
                    "</tr>"
                );
            }
            this.uiFunctions.generateSteppers("#embark-items");
            this.uiFunctions.registerStepperListeners("#embark-items");
        },
		
    });

    return UIOutEmbarkSystem;
});
