// Status of enemies in a sector including locales 
define(['ash'], function (Ash) {
    
    var SectorControlComponent = Ash.Class.extend({
        
        maxSectorEnemies: 0,
        
        maxLocaleEnemies: {},
        currentLocaleEnemies: {},
        
        constructor: function (enemies, localeEnemies) {
            this.maxSectorEnemies = enemies;         
            this.maxLocaleEnemies = {};
            this.currentLocaleEnemies = {};
            
            for (var localeId in localeEnemies) {
                this.maxLocaleEnemies[localeId] = localeEnemies[localeId];
                this.currentLocaleEnemies[localeId] = localeEnemies[localeId];
            }
        },
        
        hasControlOfLocale: function (localeId) {
            if (!localeId) false;
            return this.currentLocaleEnemies[localeId] <= 0;
        },
        
        getMaxEnemies: function (localeId) {
            if (!localeId) return this.maxSectorEnemies;
            return this.maxLocaleEnemies[localeId] ? this.maxLocaleEnemies[localeId] : 0;
        },
        
        getCurrentEnemies: function (localeId) {
            if (!localeId) return 25;
            return this.currentLocaleEnemies[localeId] ? this.currentLocaleEnemies[localeId] : 0;
        },
        
        addWin: function (localeId) {
            if (!localeId) return;
            console.log("add win " + localeId + " " + this.currentLocaleEnemies[localeId]);
            this.currentLocaleEnemies[localeId]--;
        },
         
        getSaveKey: function () {
            return "ScCtrl";
        },
        
        getCustomSaveObject: function () {
            var copy = {};
            if (this.currentLocaleEnemies && Object.keys(this.currentLocaleEnemies).length > 0)
                copy.cLE = this.currentLocaleEnemies;
            return Object.keys(copy).length > 0 ? copy : null;
        },
        
        customLoadFromSave: function (componentValues) {            
            var localeEnemies = componentValues.currentLocaleEnemies;
            if (componentValues.cLE)
                localeEnemies = componentValues.cLE;
            
            for (var locale in localeEnemies) {
                this.currentLocaleEnemies[locale] = localeEnemies[locale];
            }
        }
        
    });

    return SectorControlComponent;
});
