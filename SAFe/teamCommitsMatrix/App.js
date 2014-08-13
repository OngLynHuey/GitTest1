Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
	layout:'absolute',
		
	/****************************************************** SHOW ERROR/TEXT MESSAGE ********************************************************/
	_showError: function(text){
		if(this.errMessage) this.remove(this.errMessage);
		this.errMessage = this.add({xtype:'text', text:text});
	},
	/****************************************************** DATA STORE/MODEL METHODS ********************************************************/

	_loadModels: function(cb){
		var me = this;
		Rally.data.ModelFactory.getModel({ //load project
			type:'Project',
			success: function(model){ 
				me.Project = model; 
				Rally.data.ModelFactory.getModel({ //load project
					type:'PortfolioItem/Milestone',
					success: function(model){ 
						me.Milestone = model; 
						cb(); 
					}
				});
			}
		});
	},
	
	_loadProject: function(project, cb){ 
		var me = this;
		me.Project.load(project.ObjectID, {
			fetch: ['ObjectID', 'Children', 'Parent', 'Name'],
			context: {
				workspace: me.getContext().getWorkspace()._ref,
				project: null
			},
			callback: function(record, operation){
				if(operation.wasSuccessful()) cb(record);
				else me._showError('failed to retreive project: ' + project.ObjectID);
			}
		});
	},
	
	_loadMilestone: function(milestone, cb){ 
		var me = this;
		me.Milestone.load(milestone.ObjectID, {
			fetch: ['ObjectID', 'Parent', 'Name'],
			context: {
				workspace: me.getContext().getWorkspace()._ref,
				project: null
			},
			callback: function(record, operation){
				if(operation.wasSuccessful()) cb(record);
				else me._showError('failed to retreive milestone: ' + milestone.ObjectID);
			}
		});
	},
	
	_loadReleases: function(cb){ 
		var me = this;
		Ext.create('Rally.data.wsapi.Store',{
			model: 'Release',
			autoLoad:true,
			limit:Infinity,
			fetch: ['Name', 'ObjectID', 'ReleaseDate', 'ReleaseStartDate', 'Project'],
			context:{
				workspace: me.getContext().getWorkspace()._ref,
				project: null
			},
			filters:[
				{
					property:'Project.ObjectID',
					value: me.TrainRecord.data.ObjectID
				},{
					property:'Name',
					operator:'contains',
					value: me.TrainRecord.data.Name.split(' ART ')[0]
				}
			],
			listeners: {
				load: {
					fn: function(releaseStore, releaseRecords){
						console.log('releases loaded:', releaseRecords);
						me.MatrixReleaseStore = releaseStore;
						cb();
					},
					single:true
				}
			}
		});
	},
	
	_loadMatrixFeatures: function(cb){ 
		var me = this;
		me.MatrixProductHash = {};
		Ext.create('Rally.data.wsapi.Store',{
			model: 'PortfolioItem/Feature',
			autoLoad:true,
			limit:Infinity,
			fetch: ['Name', 'ObjectID', 'Project', 'Parent', 'FormattedID', 'UserStories', 'c_TeamCommits', 'DragAndDropRank'],
			context:{
				workspace: me.getContext().getWorkspace()._ref,
				project: null
			},
			filters:[
				{
					property:'Release.Name',
					value: me.ReleaseRecord.data.Name
				}
			],
			listeners: {
				load: {
					fn: function(featureStore, featureRecords){
						console.log('features loaded:', featureRecords);
						me.MatrixFeatureStore = featureStore;
						var finished = -1;
						var done = function(){ if(++finished == featureRecords.length) { cb(); } };
						done();
						featureRecords.forEach(function(fr){
							var frData = fr.data;
							if(frData.Parent){
								me._loadMilestone(frData.Parent, function(milestoneRecord){
									var p = milestoneRecord.data.Parent;
									me.MatrixProductHash[frData.ObjectID] = ((p && p.Name ) ? p.Name : '');
									done();
								});
							}
							else {
								me.MatrixProductHash[frData.ObjectID] = '';
								done();
							}
							
						});
					},
					single:true
				}
			}
		});
	},
	
	_loadMatrixUserStoryBreakdown: function(cb){
		var me = this;
		me.MatrixUserStoryBreakdown = {};
		me.MatrixProjectMap = {};
		var fRecords = me.MatrixFeatureStore.getRecords();
		var finished = -1;
		var done = function(){ 
			if(++finished == fRecords.length){ 
				console.log('Stories loaded:', me.MatrixUserStoryBreakdown);
				cb(); 
			}
		};
		done();
		fRecords.forEach(function(fRecord){
			Ext.create('Rally.data.wsapi.Store',{
				model:'HierarchicalRequirement',
				fetch: ['ObjectID', 'Project', 'Name', 'Feature'],
				limit:Infinity,
				autoLoad:true,
				context:{
					workspace: me.getContext().getWorkspace()._ref,
					project: null
				},
				filters: [
					{
						property:'Release.Name',
						value:me.ReleaseRecord.data.Name
					},{
						property:'Feature.ObjectID',
						value:fRecord.data.ObjectID
					}
				],
				listeners: {
					load: {
						fn: function(storyStore, storyRecords){
							storyRecords.forEach(function(sr){
								var PName = sr.data.Project.Name;
								var FName = fRecord.data.Name;
								if(!me.MatrixUserStoryBreakdown[PName]) 
									me.MatrixUserStoryBreakdown[PName] = {};
								if(!me.MatrixUserStoryBreakdown[PName][FName]) 
									me.MatrixUserStoryBreakdown[PName][FName] = 0;
								++me.MatrixUserStoryBreakdown[PName][FName];	
								me.MatrixProjectMap[PName] = sr.data.Project.ObjectID;					
							});
							done();
						},
						single:true
					}
				}
			});
		});
	},	
	
	/*************************************************** DEFINE MODELS ******************************************************/
	_defineModels: function(){								
		Ext.define('IntelFeature', {
			extend: 'Ext.data.Model',
			fields: [
				{name: 'Rank', type:'string'},
				{name: 'FormattedID', type:'string'},
				{name: 'ObjectID', type:'string'},
				{name: 'FeatureName',  type: 'string'},
				{name: 'ProductName', type:'string'}
			]
		});
	},
	
	_reloadingStores: true,
	
	_reloadMatrixStores: function(){
		var me = this;
		if(me.MatrixFeatureStore) {
			me.MatrixFeatureStore.load({
				callback: function(){
					me.featureTCAECache = {};
					if(me.CustomMatrixStore)
						me.CustomMatrixStore.load();
				}
			});
		}
	},
	
	/*************************************************** RANDOM HELPERS ******************************************************/	
	_projectInWhichTrain: function(projectRecord, cb){ // returns train the projectRecord is in, otherwise null.
		var me = this;
		if(!projectRecord) cb();
		var split = projectRecord.data.Name.split(' ART ');
		if(split.length>1) cb(projectRecord);
		else { 
			var parent = projectRecord.data.Parent;
			if(!parent) cb();
			else {
				me._loadProject(parent, function(parentRecord){
					me._projectInWhichTrain(parentRecord, cb);
				});
			}
		}
	},
	
	_getCurrentOrFirstRelease: function(){
		var me = this;
		var d = new Date();
		var rs = me.MatrixReleaseStore.getRecords();
		if(!rs.length) return;
		for(var i=0; i<rs.length; ++i){
			if(new Date(rs[i].data.ReleaseDate) >= d && new Date(rs[i].data.ReleaseStartDate) <= d) 
				return rs[i];
		}
		return rs[0]; //pick a random one then 
	},
	
	/******************************************************* LAUNCH/UPDATE APP********************************************************/
	launch: function(){
		var me = this;
		me._defineModels();
		setInterval(function(){ me._reloadMatrixStores();}, 10000); 
		me._showError('Loading Data...');
		me._loadModels(function(){
			var scopeProject = me.getContext().getProject();
			me._loadProject(scopeProject, function(scopeProjectRecord){
				me._projectInWhichTrain(scopeProjectRecord, function(trainRecord){
					if(trainRecord){
						me.TrainRecord = trainRecord; 
						console.log('train loaded:', trainRecord);
						me._loadReleases(function(){
							var currentRelease = me._getCurrentOrFirstRelease();
							if(currentRelease){
								me.ReleaseRecord = currentRelease;
								console.log('release loaded', currentRelease);
								me._loadMatrixFeatures(function(){	
									me._loadMatrixUserStoryBreakdown(function(){
										me.removeAll();
										me._loadMatrixGrid();
									});
								});
							} else {
								me.removeAll();
								me._showError('This ART has no releases');
							}
						});
					} else{
						me.removeAll();
						me._showError('Please scope to an ART');
					}
				});
			});
		});
	},
	
	/******************************************************* RENDER ********************************************************/
	_loadMatrixGrid: function(){
		var me = this;

		me.featureTCAECache = {};
		
		function getTeamCommit(featureRecord, ProjectName){	
			var tcs = featureRecord.data.c_TeamCommits;
			var featureID = featureRecord.data.ObjectID;
			var projectID = me.MatrixProjectMap[ProjectName];
			var this_tc;
			try{ 
				var parsed_tcs;
				if(me.featureTCAECache[featureID]) 
					parsed_tcs = me.featureTCAECache[featureID];
				else {
					parsed_tcs = JSON.parse(tcs) || {};
					me.featureTCAECache[featureID] = parsed_tcs;
				}
				this_tc = parsed_tcs[projectID] || {}; 
			} 
			catch(e){ me.featureTCAECache[featureID] = this_tc = {}; }
			return this_tc;
		}
		
		function setExpected(featureRecord, ProjectName, value){
			var tcs = featureRecord.data.c_TeamCommits;
			var featureID = featureRecord.data.ObjectID;
			var projectID = me.MatrixProjectMap[ProjectName];
			try{ 
				if(me.featureTCAECache[featureID]) 
					tcs = me.featureTCAECache[featureID];
				else {
					tcs = JSON.parse(tcs) || {};
					me.featureTCAECache[featureID] = tcs;
				}
			} 
			catch(e){ me.featureTCAECache[featureID] = this_tc = {}; }
			if(!tcs[projectID]) 
				tcs[projectID] = {};
			tcs[projectID].Expected = value;
			featureRecord.set('c_TeamCommits', JSON.stringify(tcs, null, '\t'));
			featureRecord.save();
		}

		var customMatrixRecords = _.map(me.MatrixFeatureStore.getRecords(), function(featureRecord){
			return {
				Rank: featureRecord.get('DragAndDropRank'),
				FormattedID: featureRecord.get('FormattedID'),
				ObjectID: featureRecord.get('ObjectID'),
				FeatureName: featureRecord.get('Name'),
				ProductName: me.MatrixProductHash[featureRecord.get('ObjectID')]
			};
		});		

		me.CustomMatrixStore = Ext.create('Ext.data.Store', {
			data: customMatrixRecords,
			model: 'IntelFeature',
			autoSync:true,
			limit:Infinity,
			proxy: {
				type:'sessionstorage',
				id: 'Session-proxy-' + Math.random()
			}
		});

		var defColumnCfgs = [
			{
				text:'Rank', 
				dataIndex:'Rank',
				width:50,
				editor:false,
				sortable:true,
				resizable:false,
				renderer: function(oid, meta, f1){
					var rank = 1;
					var f1OID = f1.data.ObjectID;
					f1 = me.MatrixFeatureStore.findRecord('ObjectID', f1OID);
					var f1DADR = f1.data.DragAndDropRank;
					me.MatrixFeatureStore.getRecords().forEach(function(f2){
						if((f2.get('ObjectID') != f1OID) && (f1DADR > f2.get('DragAndDropRank')))
							++rank;
					});
					return rank;
				}
			},{
				text:'F#', 
				dataIndex:'FormattedID',
				width:50,
				editor:false,
				resizable:false,
				sortable:true,
				renderer:function(FID){
					var feature = me.MatrixFeatureStore.findRecord('FormattedID', FID);
					if(feature.get('Project')) {
						var pid = feature.get('Project')._ref.split('/project/')[1];
						return '<a href="https://rally1.rallydev.com/#/' + pid + 'd/detail/portfolioitem/feature/' + 
								feature.get('ObjectID') + '">' + FID + '</a>';
					}
					else return name;
				}
			},{
				text:'Feature', 
				dataIndex:'FeatureName',
				width:250,
				editor:false,
				resizable:false,
				sortable:true
			},{
				text:'Product', 
				dataIndex:'ProductName',
				width:100,
				editor:false,
				resizable:false,
				sortable:true
			}
		];
		var columnCfgs = [].concat(defColumnCfgs);
		Object.keys(me.MatrixUserStoryBreakdown).sort().forEach(function(ProjectName){
			columnCfgs.push({
				text: ProjectName,
				dataIndex:'ObjectID',
				width:50,
				editor:'textfield',
				align:'center',
				tdCls: 'intel-editor-cell',
				sortable:false,
				resizable:false,
				renderer: function(oid, metaData, matrixRecord, row, col){
					var featureRecord = me.MatrixFeatureStore.findRecord('ObjectID', matrixRecord.get('ObjectID'));
					var count = me.MatrixUserStoryBreakdown[ProjectName][featureRecord.data.Name] || 0;
					var tcae = getTeamCommit(featureRecord, ProjectName);
					var Expected = tcae.Expected || false;
					var Commitment = tcae.Commitment || 'Undecided'; 
					if(Commitment === 'Undecided') metaData.tdCls += ' intel-team-commits-WHITE';
					if(Commitment === 'N/A') metaData.tdCls += ' intel-team-commits-GREY';
					if(Commitment === 'Committed') metaData.tdCls += ' intel-team-commits-GREEN';
					if(Commitment === 'Not Committed') metaData.tdCls += ' intel-team-commits-RED';
					if(Expected) metaData.tdCls += '-YELLOW';
					
					return count;
				}
			});
		});
		
		me.MatrixReleasePicker = me.add({
			xtype:'combobox',
			x:0, y:0,
			store: Ext.create('Ext.data.Store', {
				fields: ['Name'],
				data: _.map(me.MatrixReleaseStore.getRecords(), function(r){ return {Name: r.get('Name') }; })
			}),
			displayField: 'Name',
			fieldLabel: 'Release:',
			editable:false,
			value:me.ReleaseRecord.get('Name'),
			listeners: {
				select: function(combo, records){
					if(me.ReleaseRecord.get('Name') === records[0].get('Name')) return;
					me.ReleaseRecord = me.MatrixReleaseStore.findRecord('Name', records[0].get('Name'));						
					me._loadMatrixFeatures(function(){	
						me._loadMatrixUserStoryBreakdown(function(){
							me.removeAll();
							me._loadMatrixGrid();
							me.setLoading(true);
							setTimeout(function(){me.setLoading(false); }, 2000);
						});
					});
				}
			}
		});
		
		me.MatrixProductPicker = me.add({
			xtype:'combobox',
			x:300, y:0,
			fieldLabel:'Product Filter',
			store: Ext.create('Ext.data.Store', {
				fields:['ProductName'],
				data: _.map(_.reduce(Object.keys(me.MatrixProductHash), function(items, ObjectID){
					var projectName = me.MatrixProductHash[ObjectID];
					if(items.indexOf(projectName) == -1) items.push(projectName);
					return items;
				}, ['All Products']), function(name){ return {ProductName: name}; })
			}),
			displayField: 'ProductName',
			editable:false,
			value:'All Products',
			listeners: {
				select: function(combo, records){
					var value = records[0].get('ProductName');
					me.CustomMatrixStore.filters.getRange().forEach(function(filter){
						me.CustomMatrixStore.removeFilter(filter);
					});
					if(value !== 'All Products'){
						me.CustomMatrixStore.addFilter(new Ext.util.Filter({
							filterFn: function(matrixRecord){
								return matrixRecord.get('ProductName') === value;
							}
						}));
					}
				}
			}
		});
		
		me.MatrixLegend = me.add({
			xtype:'container',
			layout:'table',
			columns:5,
			width:800, x:600, y:0,
			border:true,
			frame:false,
			items: _.map(['Committed', 'Not Committed', 'N/A', 'Undefined', 'Expected'], function(name){
				var color;
				if(name === 'Undecided') color='white';
				if(name === 'N/A') color='grey';
				if(name === 'Committed') color='green';
				if(name === 'Not Committed') color='red';
				if(name === 'Expected') color='yellow';
				return {
					xtype: 'container',
					width:160,
					border:false,
					frame:false,
					html:'<div class="intel-legend-item">' + name + 
						': <div style="background-color:' + color + '" class="intel-legend-dot"></div></div>'
				};
			})
		});
		
		me.MatrixGrid = me.add({
			xtype: 'rallygrid',
			x:0, y:50,
			height:1200,
			width: _.reduce(columnCfgs, function(item, sum){ return sum + item.width; }, 20),
			scroll:'both',
			resizable:false,
			columnCfgs: columnCfgs,
			plugins: [
				Ext.create('Ext.grid.plugin.CellEditing', {
					triggerEvent:'cellclick'
				})
			],
			listeners: {
				beforeedit: function(editor, e){
					var ProjectName = e.column.text,
						matrixRecord = e.record;
					var featureRecord = me.MatrixFeatureStore.findRecord('ObjectID', matrixRecord.get('ObjectID'));
					var tcae = getTeamCommit(featureRecord, ProjectName);
					setExpected(featureRecord, ProjectName, !tcae.Expected);
					matrixRecord.commit(); //just so it rerenders this record 
					return false;
				}
			},
			showRowActionsColumn:false,
			showPagingToolbar:false,
			enableEditing:false,
			context: me.getContext(),
			store: me.CustomMatrixStore
		});	
	}
});