Ext.define('IntelRallyApp', {
	alias: 'widget.intelrallyapp',
  extend: 'Rally.app.App',
	
	/** these are the necessary models to load for the apps. you should call this */
	_loadModels: function(){
		var me=this, 
			promises = [],
			models = {
				Project: 'Project',
				UserStory: 'HierarchicalRequirement',
				Feature:'PortfolioItem/Feature',
				Milestone:'PortfolioItem/Milestone'
			};
		_.each(models, function(modelType, modelName){
			var deferred = Q.defer();
			Rally.data.WsapiModelFactory.getModel({ //load project
				type:modelType, 
				success: function(loadedModel){ 
					me[modelName] = loadedModel;
					deferred.resolve();
				}
			});
			promises.push(deferred.promise);
		});
		return Q.all(promises);
	},
	
	_loadProject: function(oid){ 
		var me = this, deferred = Q.defer();
		if(!oid) return Q.resolve();
		else if(!me.Project){ 
			return me._loadModels().then(function(){ 
				return me._loadProject(oid); 
			});
		}
		else {
			me.Project.load(oid, {
				fetch: ['ObjectID', 'Releases', 'Children', 'Parent', 'Name'],
				context: {
					workspace: me.getContext().getWorkspace()._ref,
					project: null
				},
				callback: deferred.resolve
			});
			return deferred.promise;
		}
	},
	
	_loadFeature: function(oid, projectRef){ //projectRef is optional
		var me = this, deferred = Q.defer();
		if(!oid) return Q.resolve();
		else if(!me.Feature){ 
			return me._loadModels().then(function(){ 
				return me._loadFeature(oid, projectRef); 
			});
		}
		else {
			me.Feature.load(oid, {
				fetch: ['Name', 'ObjectID', 'FormattedID', 'c_TeamCommits', 'c_Risks', 'Project', 'PlannedEndDate', 'Parent'],
				context: {
					workspace: me.getContext().getWorkspace()._ref,
					project: projectRef
				},
				callback: deferred.resolve
			});
			return deferred.promise;
		}
	},
	
	_loadUserStory: function(oid, projectRef){ 
		var me = this, deferred = Q.defer();
		if(!oid) return Q.resolve();
		else if(!me.UserStory){ 
			return me._loadModels().then(function(){ 
				return me._loadUserStory(oid, projectRef); 
			});
		}
		else {
			me.UserStory.load(oid, {
				fetch: ['Name', 'ObjectID', 'Release', 'Project', 'Feature',
					'FormattedID', 'Predecessors', 'Successors', 'c_Dependencies', 'Iteration', 'PlanEstimate'],
				context: {
					workspace: me.getContext().getWorkspace()._ref,
					project: projectRef
				},
				callback: deferred.resolve
			});
			return deferred.promise;
		}
	},
	
	_loadMilestone: function(oid, projectRef){ 
		var me = this, deferred = Q.defer();
		if(!oid) return Q.resolve();
		else if(!me.Milestone){ 
			return me._loadModels().then(function(){ 
				return me._loadMilestone(oid); 
			});
		}
		else {
			me.Milestone.load(oid, {
				fetch: ['ObjectID', 'Parent', 'Name'],
				context: {
					workspace: me.getContext().getWorkspace()._ref,
					project: projectRef
				},
				callback: deferred.resolve
			});
			return deferred.promise;
		}
	},
	
	/**************************************** SOME UTIL FUNCS ***************************************************/
	_loadRootProject: function(projectRecord){
		if(!projectRecord) return Q.reject('Invalid arguments: LRP');
		var me=this, 
			n = projectRecord.data.Name;
		if(n === 'All Scrums' || n === 'All Scrums Sandbox') return Q(projectRecord);
		else if(!projectRecord.data.Parent) return Q.reject('Please Scope to a valid team for Release Planning');
		else {
			return me._loadProject(projectRecord.data.Parent.ObjectID).then(function(parentRecord){
				return me._loadRootProject(parentRecord);
			});
		}
	},
	
	_loadTopProject: function(projectRecord){
		if(!projectRecord) return Q.reject('Invalid arguments: LTP');
		var me=this, 
			n = projectRecord.data.Name;
		if(!projectRecord.data.Parent) return Q(projectRecord);
		else {
			return me._loadProject(projectRecord.data.Parent.ObjectID).then(function(parentRecord){
				return me._loadTopProject(parentRecord);
			});
		}
	},
	
	_projectInWhichTrain: function(projectRecord){ // returns train the projectRecord is in, otherwise null.
		if(!projectRecord) return Q.reject('Invalid arguments: PIWT');
		else {
			var me=this, split = projectRecord.data.Name.split(' ART');
			if(split.length>1) return Q(projectRecord);
			else { 
				var parent = projectRecord.data.Parent;
				if(!parent) return Q.reject('Project not in a train');
				else {
					return me._loadProject(parent.ObjectID).then(function(parentRecord){
						return me._projectInWhichTrain(parentRecord);
					});
				}
			}
		}
	},
	
	_loadAllTrains: function(rootProjectRecord){
		if(!rootProjectRecord) return Q.reject('Invalid arguments: LAT');
		var me=this,
			store = Ext.create('Rally.data.wsapi.Store',{
				model: 'Project',
				remoteSort:false,
				limit:Infinity,
				fetch: ['Name', 'ObjectID'],
				context:{
					workspace: me.getContext().getWorkspace()._ref,
					project: null
				},
				filters:[{
						property:'Name',
						operator: 'contains',
						value: ' ART'
					},{
						property: 'Name',
						operator: (rootProjectRecord.data.Name === 'All Scrums Sandbox' ? 'contains' : '!contains'),
						value: 'Test'
					}
				]
			});
		return me._reloadStore(store).then(function(store){
			console.log('AllTrainRecords loaded', store.data.items);
			return Q(store);
		});
	},
			
	_loadRandomUserStory: function(projectRef){ //get the most recent 5 in the project!!
		if(!projectRef) return Q.reject('Invalid arguments: LRUS');
		var me=this,
			store = Ext.create('Rally.data.wsapi.Store',{
				model: 'HierarchicalRequirement',
				limit:5,
				pageSize:5,
				fetch: ['Name', 'CreationDate', 'Project', 'ObjectID', 'FormattedID', 'Predecessors', 'Successors', 'c_Dependencies'],
				context:{
					workspace: me.getContext().getWorkspace()._ref,
					project: undefined
				},
				sorters: [{
					property: 'CreationDate', 
					direction:'DESC'
				}],
				filters:[{
					property:'Project',
					value: projectRef
				}]
			});
		return me._reloadStore(store).then(function(store){
			var records = store.data.items;
			if(records.length) return Q(records[Math.floor(Math.random()*records.length)]);
			else return Q(undefined);
		});
	},
	
	_loadUserStoryByFID: function(formattedID, projectRef){ //must supply both argument
		if(!formattedID || !projectRef) return Q.reject('Invalid arguments: LUSBFID');
		var me=this,
			store = Ext.create('Rally.data.wsapi.Store',{
				model: 'HierarchicalRequirement',
				limit:1,
				pageSize:1,
				fetch: ['Name', 'Project', 'ObjectID', 'FormattedID', 'Predecessors', 'Successors', 'c_Dependencies'],
				context:{
					workspace: me.getContext().getWorkspace()._ref,
					project: undefined
				},
				filters: [{
					property:'FormattedID',
					value:formattedID
				},{
					property:'Project',
					value: projectRef
				}]
			});
		return me._reloadStore(store).then(function(store){
			return Q(store.data.items.pop());
		});
	},
	
	_loadProjectByName: function(name){
		if(!name) return Q.reject('Invalid arguments: LPBN');
		var me=this,
			store = Ext.create('Rally.data.wsapi.Store',{
				model: 'Project',
				limit:1,
				pageSize:1,
				fetch: ['Name', 'ObjectID'],
				context:{
					workspace: me.getContext().getWorkspace()._ref,
					project: null
				},
				filters: [
					{
						property:'Name',
						value:name
					}
				]
			});
		return me._reloadStore(store).then(function(store){
			return Q(store.data.items.pop());
		});
	},
	
	/********************************************** FEATURES  ********************************************/
	_getFeatureFilter: function(trainRecord, releaseRecord){
		if(!trainRecord || !releaseRecord) throw 'invalid arguments: GFF';
		var me=this,
			trainName = trainRecord.data.Name.split(' ART')[0],
			relSplit = releaseRecord.data.Name.split(' '),
			coreFilter = Ext.create('Rally.data.wsapi.Filter', {
				property:'Release.Name',
				value: releaseRecord.data.Name
			});
		trainName = relSplit.length == 2 ? relSplit[1] : trainName; //switches where features are if release is "Qxxx TrainName"
		if(trainRecord.data.Name == 'Test ART (P&E)'){
			return Ext.create('Rally.data.wsapi.Filter', {
				property:'Project.Name',
				value: 'Test ART (P&E)'
			}).and(coreFilter);
		}
		else {
			return Ext.create('Rally.data.wsapi.Filter', { //NOTE: they should NOT be in the POWG portfolio level, but we will cover that just in case
				property:'Project.Parent.Name',
				value: trainName + ' POWG Portfolios'
			}).or(Ext.create('Rally.data.wsapi.Filter', {
				property:'Project.Name',
				value: trainName + ' POWG Portfolios'
			})).and(coreFilter);
		}
	},
	
	/*************************************************** Products ********************************************/
	_getProductFilter: function(trainRecord){ //products can be in 2 different levels of the portfolio hierarchy
		if(!trainRecord) throw 'invalid arguments: GPF';
		var me=this,
			trainName = trainRecord.data.Name.split(' ART')[0];
		if(trainName === 'Test'){
			return Ext.create('Rally.data.wsapi.Filter', {
				property:'Project.Name',
				value: 'Test ART (P&E)'
			});
		}
		else {
			return Ext.create('Rally.data.wsapi.Filter', {//NOTE: they should NOT be in the POWG portfolio level, but we will cover that just in case
				property:'Project.Parent.Name',
				value: trainName + ' POWG Portfolios'
			}).or(Ext.create('Rally.data.wsapi.Filter', {
				property:'Project.Name',
				value: trainName + ' POWG Portfolios'
			}));
		}
	},
	
	_loadProducts: function(trainRecord){
		if(!trainRecord) return Q.reject('Invalid arguments: LPROD');
		var me=this,
			store = Ext.create('Rally.data.wsapi.Store',{
				model: 'PortfolioItem/Product',
				limit:Infinity,
				remoteSort:false,
				fetch: ['Name'],
				context:{
					workspace: me.getContext().getWorkspace()._ref,
					project: null
				},
				filters:[me._getProductFilter(trainRecord)]
			});
		return me._reloadStore(store).then(function(store){
			console.log('Products loaded', store.data.items);
			return Q(store);
		});
	},
	
	/********************************************** Load Valid Projects ********************************************/
	
	_addValidProjectsToList: function(projTree, hash){
		var me=this, 
			curProj = projTree.ProjectRecord;
		if(curProj.data.TeamMembers.Count >0) 
			hash[curProj.data.ObjectID] = curProj;
		for(var childProjRef in projTree){
			if(childProjRef !== 'ProjectRecord')
				me._addValidProjectsToList(projTree[childProjRef], hash);
		}
	},
	
	_loadValidProjects: function(rootProjectRecord){ //all projects under root that have team Members
		if(!rootProjectRecord) return Q.reject('Invalid arguments: LVP');
		var me=this,
			validProjects = {}, 
			projTree = {};
		var store = Ext.create('Rally.data.wsapi.Store', {
			model: "Project",
			fetch: ['Name', 'Parent', 'ObjectID', 'TeamMembers'],
			limit:Infinity,
			context: {
				workspace: me.getContext().getWorkspace()._ref,
				project:null
			}
		});
		return me._reloadStore(store).then(function(store){
			var projects = store.data.items;
			for(var i=0, len=projects.length; i<len; ++i){
				var project = projects[i],
					thisRef = project.data.ObjectID, 
					parentRef = project.data.Parent ? project.data.Parent.ObjectID : undefined;
				if(!projTree[thisRef]) projTree[thisRef] = {};
				projTree[thisRef].ProjectRecord = project;
				if(parentRef){
					if(!projTree[parentRef]) projTree[parentRef] = {};
					projTree[parentRef][thisRef] = projTree[thisRef];
				}
			}
			me._addValidProjectsToList(projTree[rootProjectRecord.data.ObjectID], validProjects);
			console.log('valid projects', validProjects);
			return Q(validProjects);
		});	
	},
	
	_allChildProjectToList: function(projTree, hash){
		var me=this, 
			curProj = projTree.ProjectRecord;
		hash[curProj.data.ObjectID] = curProj;
		for(var childProjRef in projTree){
			if(childProjRef !== 'ProjectRecord')
				me._allChildProjectToList(projTree[childProjRef], hash);
		}
	},
	
	_loadAllChildrenProjects: function(rootProjectRecord){
		if(!rootProjectRecord) return Q.reject('Invalid arguments: LACP');
		var me=this,
			childrenProjects = {}, 
			projTree = {};
		var store = Ext.create('Rally.data.wsapi.Store', {
			model: "Project",
			fetch: ['Name', 'Parent', 'ObjectID'],
			limit:Infinity,
			context: {
				workspace: me.getContext().getWorkspace()._ref,
				project:null
			}
		});
		return me._reloadStore(store).then(function(store){
			var projects = store.data.items;
			for(var i=0, len=projects.length; i<len; ++i){
				var project = projects[i],
					thisRef = project.data.ObjectID, 
					parentRef = project.data.Parent ? project.data.Parent.ObjectID : undefined;
				if(!projTree[thisRef]) projTree[thisRef] = {};
				projTree[thisRef].ProjectRecord = project;
				if(parentRef){
					if(!projTree[parentRef]) projTree[parentRef] = {};
					projTree[parentRef][thisRef] = projTree[thisRef];
				}
			}
			me._allChildProjectToList(projTree[rootProjectRecord.data.ObjectID], childrenProjects);
			console.log('childrenProjects', childrenProjects);
			return Q(childrenProjects);
		});	
	},
	
	_allLeafProjectsToList: function(projTree, hash){
		var me=this, 
			curProj = projTree.ProjectRecord;
		if(curProj.data.Children.Count === 0) 
			hash[curProj.data.ObjectID] = curProj;
		for(var childProjRef in projTree){
			if(childProjRef !== 'ProjectRecord')
				me._allChildProjectToList(projTree[childProjRef], hash);
		}
	},
	
	_loadAllLeafProjects: function(rootProjectRecord){
		if(!rootProjectRecord) return Q.reject('Invalid arguments: LALP');
		var me=this,
			childrenProjects = {}, 
			projTree = {};
		var store = Ext.create('Rally.data.wsapi.Store', {
			model: "Project",
			fetch: ['Name', 'Parent', 'ObjectID', 'Children'],
			limit:Infinity,
			context: {
				workspace: me.getContext().getWorkspace()._ref,
				project:null
			}
		});
		return me._reloadStore(store).then(function(store){
			var projects = store.data.items;
			for(var i=0, len=projects.length; i<len; ++i){
				var project = projects[i],
					thisRef = project.data.ObjectID, 
					parentRef = project.data.Parent ? project.data.Parent.ObjectID : undefined;
				if(!projTree[thisRef]) projTree[thisRef] = {};
				projTree[thisRef].ProjectRecord = project;
				if(parentRef){
					if(!projTree[parentRef]) projTree[parentRef] = {};
					projTree[parentRef][thisRef] = projTree[thisRef];
				}
			}
			me._allLeafProjectsToList(projTree[rootProjectRecord.data.ObjectID], childrenProjects);
			console.log('childrenProjects', childrenProjects);
			return Q(childrenProjects);
		});	
	},
	
	/********************************************** Generic store loading, returns promise ********************************************/
	
	_reloadStore: function(store){
		var deferred = Q.defer();
		store.load({
			callback: function(records, operation, success){
				if(!success) deferred.reject(operation.getError() || 'Could not load data');
				else deferred.resolve(store);
			}
		});
		return deferred.promise;
	}
});