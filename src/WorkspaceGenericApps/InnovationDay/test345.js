(function(){
	var Ext = window.Ext4 || window.Ext;
	Ext.define('Intel.InnovationDay', {
			extend: 'Intel.lib.IntelRallyApp',
			componentCls: 'app',
			mixins: [
				'Intel.lib.mixin.PrettyAlert',
				'Intel.lib.mixin.UserAppsPreference',
				'Intel.lib.mixin.ParallelLoader',
				'Intel.lib.mixin.CustomAppObjectIDRegister'
			],
			userAppsPref: 'intel-innovationday-apps-preference',
			releaseFields:[],
			items: [{
				xtype: 'container',
				id: 'idea_wrapper',
				layout: {
					type: 'hbox'
				},
				items:[{
					xtype: 'textfield',
					id: 'ideaTxt',
					fieldLabel: 'Idea',
					allowBlank: true
				},{
					xtype: 'textfield',
					fieldLabel: 'Why',
					id: 'whyTxt',
					allowBlank: true					
				},{
					xtype: 'container',
					id: 'ideaBtnContainer'
				}],
				xtype: 'container',
				id: 'ideaGrid'
			}],
			_createGridStoreAndRenderGrid: function(){
				var me = this;
				me.ideaOwnerUserObjectId = Rally.data.PreferenceManager._getCurrentUserRef().replace("/user/","");
				debugger;
				var themedata = me.currentRelease.data.Theme.length> 0 ? JSON.parse(atob(me.currentRelease.data.Theme)):{};
				var gridStore = Ext.create('Rally.data.custom.Store',{
						data: themedata
				});
				var columnConfiguration = [
					{	header: "Ideas", 
						dataIndex: "Ideas"
					},{
						header: "Why", 
						dataIndex: "Why"
					},{
						header: "Vote Count", 
						dataIndex: "voteCount",
						renderer:function(val, meta, record){
							return val.length;
						}
					},{
						header: "Vote", 
						dataIndex: "Vote",
						renderer: function (v, m, r) {
								var id = Ext.id();
								Ext.defer(function () {
							Ext.widget('button', {
									renderTo: id,
									text: '+ Vote',
									width: 60,
									handler: function () {
								//console.log('r', r.data);
								//that._getRevisionHistory(data, r.data);
									}
							});
								}, 50);
					    return Ext.String.format('<div id="{0}"></div>', id);
					}
					},{
						header: "Owner", 
						dataIndex: "owner"
					}];
					//API Docs: https://help.rallydev.com/apps/2.0/doc/
				Ext.create('Ext.Container', {
					 items: [{
						xtype: 'rallygrid',
						id:'rallyIdeaGrid',
						enableEditing: false,
						autoScroll: true,
						height: 500,
						showPagingToolbar: false,
						columnCfgs: columnConfiguration,
						listeners: {
							cellclick: function(table, td, cellIndex, record, tr, rowIndex){
								if (cellIndex === 4){
									record.data["voteCount"].push(me.ideaOwnerUserObjectId);
									Ext.getCmp('rallyIdeaGrid').view.refresh();
								}
							}
						}, 
						store: gridStore
					 }],
					 renderTo:'ideaGrid'
			 });					
			},
			_saveVote:function(){
				return _loadCurrentReleasesbyObjectId()
				.then(function(){
					//edit record by saving voteCount
					//save it
				})
			},
			_loadCurrentReleasesbyObjectId: function(){
				var me=this,
					store = Ext.create('Rally.data.wsapi.Store',{
						model: 'Release',
						limit: Infinity,
						autoLoad:false,
						fetch: ['Name', 'ObjectID', 'Theme'],
						context:{
							workspace: me.getContext().getWorkspace()._ref,
							project: null
						},
						filters:[{
							property:'ObjectID',
							value: me.currentRelease.data.ObjectID
						}]
					});
				return me.reloadStore(store).then(function(store){ return store.getRange(); });				
			},
			_addIdeaToGrid: function(){
				var me = this;
				var ideaText, whyText;
				var ideaButton = {
					xtype: 'button',
					id: 'addIdeaBtn',
					text: 'Add Idea',
					scope: me,
					handler: function(){
						//add the idea nd why to the grid
						//update the grid
						ideaText = Ext.getCmp('ideaTxt').value;
						whyText = Ext.getCmp('whyTxt').value;
						var myStore = Ext.getCmp('rallyIdeaGrid').getStore();
						var resultData = [{
							Ideas: ideaText,
							Why: whyText,
							voteCount:[me.ideaOwnerUserObjectId],
							owner: me.ideaOwnerUserObjectId,
							Vote: ""
						}];
						myStore.loadData(resultData,true);
						me._setReleaseThemeRecord(resultData);
						debugger;
						Ext.getCmp('ideaTxt').setValue "";
						Ext.getCmp('whyTxt').value = "";
						
					}
				};
				Ext.getCmp('ideaBtnContainer').add(ideaButton);
				//upgrade the grid with the value			
			},
			_loadReleasesBetweenDates: function(projectRecord, startDate, endDate){
				var me=this,
					store = Ext.create('Rally.data.wsapi.Store',{
						model: 'Release',
						limit: Infinity,
						autoLoad:false,
						fetch: ['Name', 'ObjectID', 'ReleaseDate', 'ReleaseStartDate', 'Theme'],
						context:{
							workspace: me.getContext().getWorkspace()._ref,
							project: null
						},
						filters:[{
							property:'Project.ObjectID',
							value: projectRecord.data.ObjectID
						},{
							property:'ReleaseDate',
							operator:'>',
							value: new Date(startDate).toISOString()
						},{
							property:'ReleaseStartDate',
							operator:'<',
							value: new Date(endDate).toISOString()
						}]
					});
				return me.reloadStore(store).then(function(store){ return store.getRange(); });
		},
/* 		_getThemeProperty:function(){
			var me = this;
			var id = me.currentRelease.data.ObjectID
			var ReleaseModel = Rally.data.ModelFactory.getModel({
            type:'Release'
        });
			ReleaseModel.load(id,{
					fetch: ['c_Theme'],
					callback: function(record, operation){
						debugger;
							console.log('Role prior to update:', record);
							console.log(JSON.parse(atob(record)));
					}
			}) ;
    }, */
		_setReleaseThemeRecord: function(newidea){
			var me=this,
				deferred = Q.defer();	
				newidea = me.currentRelease.data.Theme.length > 0 ? newidea.concat(JSON.parse(atob(me.currentRelease.data.Theme))) : newidea;
				str = btoa(JSON.stringify(newidea, null, '\t'));
			if(str.length >= 32768) 
				deferred.reject('Theme field for ' + me.currentRelease.data.Theme + ' ran out of space! Cannot save');
			else {
				debugger;
				me.currentRelease.set('Theme',str);
				me.currentRelease.save({ 
					callback:function(record, operation, success){
						if(!success) deferred.reject('Failed to add new idea to the Release: ' + me.currentRelease.data.Release.Name);
						else deferred.resolve(me.currentRelease);
					}
				});
			}
			return deferred.promise;			
		},
			launch: function() {
				console.log("test");
				var me = this;
				//override the intel app release field config 
				
				me.setLoading('Loading Configuration');
				me.configureIntelRallyApp()
				.then(function(){
					debugger;
					//me.releaseFields =  ['Name', 'ObjectID', 'ReleaseDate', 'ReleaseStartDate','Theme','c_Theme']
					var scopeProject = me.getContext().getProject();
					return me.loadProject(scopeProject.ObjectID)
					.then(function(scopeProjectRecord){
						me.ProjectRecord = scopeProjectRecord;
						me.loadAppsPreference() /******** load stream 2 *****/
					})
					.then(function(appsPref){
						me.AppsPref = appsPref;
						var sixMonths = 1000*60*60*24*183;
						var endDate = new Date();
						return me._loadReleasesBetweenDates(me.ProjectRecord, (new Date()*1 - sixMonths), endDate)
					})					
					.then(function(releaseRecords){
						me.ReleaseRecords = releaseRecords;
						me.currentRelease = me.getScopedRelease(releaseRecords, me.ProjectRecord.data.ObjectID, null);
						me.setLoading(false);
					})					
				})
				.then(function(){
					//load current relese
					//Write app code here
					me._createGridStoreAndRenderGrid();
				})
				.then(function(){
					me._addIdeaToGrid();
				})
				.fail(function(reason){ me.alert('ERROR', reason); })
				.done();
			}
	});
}());
