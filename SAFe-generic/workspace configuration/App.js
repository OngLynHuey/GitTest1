(function(){
	var Ext = window.Ext4 || window.Ext;
	
	/********************* PRODUCTION *****************/
	console = { log: function(){} };

	/********************* END PRODUCTION *****************/

	Ext.define('SAFeWorkspaceConfiguration', {
		extend: 'IntelRallyApp',
		mixins:[
			'WindowListener',
			'PrettyAlert',
			'IframeResize',
			'SAFeWorkspaceConfig'
		],	

		/************************************************** UTIL FUNCS **********************************************/
		_getStoreData: function(){
			var me=this;
			return _.map(me.SAFeWorkspaceConfig, function(configItem){
				return {
					TrainProjectOID: configItem.TrainProjectOID || 0,
					TrainName: configItem.TrainName || '',
					TrainAndPortfolioLocationTheSame: configItem.TrainAndPortfolioLocationTheSame ? true : false,
					PortfolioProjectOID: configItem.PortfolioProjectOID || 0
				};
			});
		},
		
		/******************************************************* LAUNCH ********************************************************/	
		launch: function(){
			var me = this;
			me._initDisableResizeHandle();
			me._initFixRallyDashboard();
			me.setLoading(true);
			if(!me.getContext().getPermissions().isWorkspaceOrSubscriptionAdmin(me.getContext().getWorkspace())) { //permission check
				me.setLoading(false);
				me._alert('ERROR', 'You do not have permissions to edit this workspace\'s settings!');
				return;
			} 
			me._loadModels()
				.then(function(){
					var scopeProject = me.getContext().getProject();
					return me._loadProject(scopeProject.ObjectID);
				})
				.then(function(scopeProjectRecord){
					return me._loadTopProject(scopeProjectRecord);
				})
				.then(function(topProject){
					return me._loadAllChildrenProjects(topProject);
				})
				.then(function(allProjects){
					me.AllProjects = allProjects;
					me.ProjectDataForStore = _.sortBy(_.map(me.AllProjects, 
						function(project){ return { Name: project.data.Name, ObjectID: project.data.ObjectID}; }),
						function(item){ return item.Name; });
					return me._loadSAFeWorkspaceConfig();
				})
				.then(function(workspaceConfig){
					me.SAFeWorkspaceConfig = workspaceConfig;
					me.setLoading(false);
					me._renderGrid();
				})
				.fail(function(reason){
					me.setLoading(false);
					me._alert('ERROR', reason || '');
				})
				.done();
		},

		/************************************************************* RENDER *******************************************/
		_renderGrid: function(){
			var me = this;
			
			me.SAFeWorkspaceConfigStore = Ext.create('Ext.data.Store', { 
				model:'IntelSAFeWorkspaceConfigItem',
				data: me._getStoreData()
			});

			var columnCfgs = [{
				text:'Train Project',
				dataIndex:'TrainProjectOID',
				tdCls: 'intel-editor-cell',	
				flex:1,
				editor:{
					xtype:'intelcombobox',
					width:'100%',
					allowBlank:true,
					store: Ext.create('Ext.data.Store', {
						fields: ['Name', 'ObjectID'],
						data: me.ProjectDataForStore
					}),
					displayField: 'Name',
					valueField: 'ObjectID'
					
				},			
				resizable:false,
				draggable:false,
				sortable:true,
				renderer:function(pid){ 
					if(!pid) return '-';
					else return me.AllProjects[pid].data.Name;
				}
			},{
				text:'Train Name', 
				dataIndex:'TrainName',
				flex:1,
				editor: 'textfield',
				resizable:false,
				draggable:false,
				sortable:true
			},{
				text:'Train And Portfolio Location The Same?', 
				xtype:'checkcolumn',
				dataIndex:'TrainAndPortfolioLocationTheSame',
				flex:1,
				resizable:false,
				draggable:false,
				sortable:true
			},{
				text:'Portfolio Project',
				dataIndex:'PortfolioProjectOID',
				flex:1,
				editor:{
					xtype:'intelcombobox',
					width:'100%',
					allowBlank:true,
					store: Ext.create('Ext.data.Store', {
						fields: ['Name', 'ObjectID'],
						data: me.ProjectDataForStore
					}),
					displayField: 'Name',
					valueField: 'ObjectID'
				},			
				resizable:false,
				draggable:false,
				sortable:true,
				renderer:function(pid, meta, record){
					if(!record.data.TrainAndPortfolioLocationTheSame) meta.tdCls += ' intel-editor-cell';
					if(record.data.TrainAndPortfolioLocationTheSame || !pid) return '-';
					else return me.AllProjects[pid].data.Name;
				}
			},{
				text:'',
				width:120,
				xtype:'fastgridcolumn',
				tdCls: 'iconCell',
				resizable:false,
				draggable:false,
				renderer: function(value, meta, record){
					return {
						xtype:'button',
						text:'Remove Train',
						width:'100%',
						handler: function(){ me.SAFeWorkspaceConfigStore.remove(record); }
					};
				}
			}];

			me.SAFeWorkspaceConfigGrid = me.add({
				xtype: 'rallygrid',
				emptyText: ' ',
				header: {
					layout: 'hbox',
					items: [{
						xtype:'text',
						cls:'grid-header-text',
						width:500,
						text:"Workspace Train Config"
					},{
						xtype:'container',
						flex:1000,
						layout:{
							type:'hbox',
							pack:'end'
						},
						items:[{
							xtype:'button',
							text:'+ Add Train',
							width:100,
							margin:'0 10 0 0',
							listeners:{
								click: function(){
									var model = Ext.create('IntelSAFeWorkspaceConfigItem', {
										TrainProjectOID: 0,
										TrainName: '',
										TrainAndPortfolioLocationTheSame: true,
										PortfolioProjectOID: 0
									});
									me.SAFeWorkspaceConfigStore.insert(0, [model]);
								}
							}
						},{
							xtype:'button',
							text:'Undo changes',
							width:100,
							margin:'0 10 0 0',
							listeners:{
								click: function(){
									me.SAFeWorkspaceConfigStore.removeAll();
									me.SAFeWorkspaceConfigStore.add(me._getStoreData());
								}
							}
						},{
							xtype:'button',
							text:'Save Config',
							width:100,
							listeners:{ 
								click: function(){
									var trainRecords = me.SAFeWorkspaceConfigStore.getRange(),
										trainData = _.map(trainRecords, function(trainRecord){
											return {
												TrainProjectOID: trainRecord.data.TrainProjectOID,
												TrainName: trainRecord.data.TrainName,
												TrainAndPortfolioLocationTheSame: trainRecord.data.TrainAndPortfolioLocationTheSame,
												PortfolioProjectOID: trainRecord.data.PortfolioProjectOID
											};
										}),
										badProjectOID = _.find(trainData, function(train){
											if(!train.TrainProjectOID) return true;
										}),
										badPortfolioOID = _.find(trainData, function(train){
											if(!train.TrainAndPortfolioLocationTheSame && !train.PortfolioProjectOID) return true;
										}),
										badTrainName = _.find(trainData, function(train){
											if(!train.TrainName) return true;
										}),
										conflictingTrainProject = _.find(trainData, function(train1, idx1){
											return _.some(trainData, function(train2, idx2){
												return idx1 != idx2 && train1.TrainProjectOID && (train1.TrainProjectOID == train2.TrainProjectOID);
											});
										}),
										conflictingTrainName = _.find(trainData, function(train1, idx1){
											return _.some(trainData, function(train2, idx2){
												return idx1 != idx2 && train1.TrainName == train2.TrainName;
											});
										});
										
									/***************** run data integrity checks before saving *************************/
									if(badProjectOID) 
										me._alert('ERROR', 'You must select a valid Train Project!');
									else if(badPortfolioOID) 
										me._alert('ERROR', 'You must select a valid Portfolio Project!');
									else if(badTrainName) 
										me._alert('ERROR', badTrainName.TrainName + ' is not a valid Train Name!');
									else if(conflictingTrainProject) 
										me._alert('ERROR', me.AllProjects[conflictingTrainProject.TrainProjectOID].data.Name + 
											' project is used for more than 1 train!');
									else if(conflictingTrainName) 
										me._alert('ERROR', conflictingTrainName.TrainName + ' Train Name is used by more than 1 Train!');
									else {
										me.SAFeWorkspaceConfigGrid.setLoading('Saving Config');
										me._saveSAFeWorkspaceConfig(trainData)
											.fail(function(reason){ me._alert(reason); })
											.then(function(){ me.SAFeWorkspaceConfigGrid.setLoading(false); })
											.done();
									}
								}
							}
						}]
					}]
				},
				margin:'10px 0 0 0',
				height:600,
				scroll:'vertical',
				columnCfgs: columnCfgs,
				disableSelection: true,
				plugins: [ 'fastcellediting' ],
				viewConfig:{
					stripeRows:true,
					preserveScrollOnRefresh:true
				},
				listeners: {
					beforeedit: function(editor, e){
						var record = e.record,
							field = e.field;
						return (field != 'PortfolioProjectOID') || !record.data.TrainAndPortfolioLocationTheSame;
					},
					edit: function(editor, e){
						var field = e.field,
							value = e.value,
							originalValue = e.originalValue,
							record = e.record;
						if(field == 'TrainName' && value != originalValue) record.set('TrainName', value.trim());
					}
				},
				showRowActionsColumn:false,
				showPagingToolbar:false,
				enableEditing:false,
				store: me.SAFeWorkspaceConfigStore
			});	
		}
	});
}());