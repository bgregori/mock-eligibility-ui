import React, { useState, createContext } from 'react'; 
import DatePicker from "react-datepicker";
 
import "react-datepicker/dist/react-datepicker.css";
import Axios from 'axios';
import { cleanup } from '@testing-library/react';

const EligibilityForm = () => {  
  
  // Primary applicant state
  const initPrimaryState = {
    name: '',
    address: '',
    ssn: '',
    applicationDate: new Date(Date.now()),
    dob: new Date(),
    usCitizen: false,
    primaryTaxFiler: false,
    income: 0.0,
    taxDependent: false,
    pregnant: false,
    pregnancyEndDate: new Date(),
    relationship: 'parent',
    result: null,
    alreadySubmitted: false,
    programName: null
  };
  const [primaryState, setPrimaryState] = useState(initPrimaryState);

  // Update primary state from onChange events
  const handlePrimaryChange = (e) => {
    setPrimaryState({...primaryState, [e.target.name]: e.target.value});
  };

  const handlePrimaryDatePickerChange = (date,target) => {
    setPrimaryState({...primaryState, [target]: date});
  };

  const handlePrimaryCheckboxChange = (e) => {
    setPrimaryState({...primaryState, [e.target.name]: e.target.checked});
  };

  // Dependents state is managed separately
  const blankIndv = {
    name: '',
    address: '',
    ssn: '',
    dob: new Date(),
    usCitizen: false,
    primaryTaxFiler: false,
    income: 0.0,
    taxDependent: false,
    pregnant: false,
    pregnancyEndDate: new Date(),
    relationship: 'parent',
    alreadySubmitted: false,
    result: null
  };

  // Initially empty list of dependents
  const [dependentState, setDependentState] = useState([
  ]);

  // Update a specific dependent onChange
  const handleDependentChange = (e) => {
    const updatedDependents = [...dependentState];
    updatedDependents[e.target.dataset.idx][e.target.className] = e.target.value;
    setDependentState(updatedDependents);
  };

  const handleDependentCheckboxChange = (e) => {
    const updatedDependents = [...dependentState];
    updatedDependents[e.target.dataset.idx][e.target.className] = e.target.checked;
    setDependentState(updatedDependents);
  };

  const handleDependentDatePickerChange = (date, idx, target) => {
    const updatedDependents = [...dependentState];
    updatedDependents[idx][target] = date;
    setDependentState(updatedDependents);
  };

  // Add a new dependent
  const addIndv = () => {
    setDependentState([...dependentState, {...blankIndv}]);
  };

  // Resets the form
  const resetState = () => {
    setDependentState([]);
    setPrimaryState(initPrimaryState);
  };

  const resetProgram = () => {
    var newState = primaryState;
    newState.programName = null;
    setPrimaryState(newState);
  }

  // Remove a specific dependent "row"
  const removeIndv = (e) => {
    var array = [...dependentState]; // make a separate copy of the array
    array.splice(e.target.dataset.idx, 1);
    setDependentState([...array]);
  };

  const formatDate = (date) => {
    const offset = date.getTimezoneOffset()
    var d = new Date(date.getTime() + (offset*60*1000))
    return d.toISOString().split('T')[0]
  };

  const mapToPayload = (individuals) => {
    
    const payload = individuals.map((item, idx) => {
      return {
              "applicantID": idx,
              "name": item.name,
              "address": item.address,
              "dateOfBirth": formatDate(item.dob),
              "primaryTaxFiler": item.primaryTaxFiler,
              "relationship": item.relationship,
              "income": item.income,
              "taxDependant": 0.0,
              //"taxDependant": item.taxDependent,
              "pregnant": item.pregnant,
              "pregnancyEndDate": item.pregnant ? formatDate(item.pregnancyEndDate) : null,
              "ssn": item.ssn,
              "uscitizen": item.usCitizen
            };
    });
    
    return payload;
  };

  const buildPayload = () => {
    var individuals = [].concat(primaryState, ...dependentState);
    
    var familyMembers = mapToPayload(individuals);

    var payload = {
      'model-namespace': null,
      'model-name': null,
      'decision-name':[],
      'decision-id':[],
      'decision-service-name':null,
      'dmn-context': {
        'ApplicationInput': {
          'com.myspace.eligibility.Application': {
            'family':familyMembers,
            'programName': primaryState.programName
          }

        }
      }
    };

    return payload;
  };

  const parseResponse = (data) => {
    console.log(data.msg);
    var assignPrograms = data.result['dmn-evaluation-result']['dmn-context']['Assign program'];
    console.log(assignPrograms);
    const updatedDependents = [...dependentState];
    assignPrograms.map((item,idx) => {
      if (item.program != null) {
        if (typeof item.program == "string") {
          item.program = null;
          item.alreadySubmitted = true;
        } else {
          item.program.programName = item.program['Program Code'] + " - " + item.program['Program Name'];
          item.program.startDate = formatDate(new Date(item.program["Eligible start"]));
          item.program.endDate = formatDate(new Date(item.program["Eligible end"]));
          item.alreadySubmitted = false;
        }
      }
      if (idx==0) {
        var newState = primaryState;
             
        newState.result = item.program;
        newState.alreadySubmitted = item.alreadySubmitted;
          
        setPrimaryState(newState);
      } 
      else {
        updatedDependents[idx-1].result = item.program;
        updatedDependents[idx-1].alreadySubmitted = item.alreadySubmitted;      
      }
    });
    setDependentState(updatedDependents);
    
  };

  const cleanupOldResults = () => {
    setPrimaryState({...primaryState, result: null});
    const updatedDependents = [...dependentState];
    updatedDependents.map((item) => {
      item.result = null;
    });
    setDependentState(updatedDependents);
  };

  // handle Evaluate
  const handleEvaluate = async (e) => {
    
    cleanupOldResults();
    
    const payload = buildPayload();

    const response = await Axios.post(
      'http://54.202.28.125:8080/kie-server/services/rest/server/containers/Demo_1.0.0-SNAPSHOT/dmn',
      payload,
      { headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': 'Basic YWRtaW5Vc2VyOlJlZEhhdA=='
      }}
    );
    if (response.status != 200) {
      alert("An error occurred!");
      return;
    }

    //set state
    var newState = primaryState;
    newState.programName = "not null value";
    setPrimaryState(newState);

    parseResponse(response.data);
  };

  return (        
    <div class="pure-g">
    <div class="pure-u-1">
    <form class="pure-form pure-form-stacked" >
      <fieldset>        
        <legend>Primary Applicant</legend>
        <div class="pure-g">
          <div class="pure-u-1 pure-u-md-1-3">
            <label htmlFor="applicationDate">Application Date</label>
            <DatePicker
              name="applicationDate"
              id="applicationDate"
              selected={primaryState.applicationDate}
              onChange={(date) => handlePrimaryDatePickerChange(date, 'applicationDate')}
            />
          </div>
        </div>
        <div class="pure-g">
          <div class="pure-u-1 pure-u-md-1-3">
            <label htmlFor="name">Name</label>   
            <input 
              type="text" 
              name="name" 
              id="name" 
              value={primaryState.name} 
              onChange={handlePrimaryChange}
            />
          </div>
          <div class="pure-u-1 pure-u-md-1-3"> 
            <label htmlFor="address">Address</label> 
            <input 
              type="text" 
              name="address" 
              id="address" 
              value={primaryState.address} 
              onChange={handlePrimaryChange}
            />
          </div>
          <div class="pure-u-1 pure-u-md-1-3">
            <label htmlFor="dob">DOB</label>
            <DatePicker
              name="dob"
              id="dob"
              selected={primaryState.dob}
              onChange={(date) => handlePrimaryDatePickerChange(date, 'dob')}
              peekNextMonth
              showMonthDropdown
              showYearDropdown
              dropdownMode="select"
            />
          </div>
        </div>
        <div class="pure-g">
          <div class="pure-u-1 pure-u-md-1-3">
            <label htmlFor="ssn">SSN</label> 
            <input 
              type="text" 
              name="ssn" 
              id="ssn" 
              value={primaryState.ssn} 
              onChange={handlePrimaryChange}
            />
          </div>
          <div class="pure-u-1 pure-u-md-1-3">
            <label htmlFor="usCitizen">US Citizen</label> 
            <input 
              type="checkbox" 
              class="pure-checkbox"
              name="usCitizen" 
              id="usCitizen" 
              value={primaryState.usCitizen} 
              onClick={handlePrimaryCheckboxChange}
            />
          </div>
          <div class="pure-u-1 pure-u-md-1-3">
            <label htmlFor="primaryTaxFiler">Primary Tax Filer</label> 
            <input
              type="checkbox" 
              class="pure-checkbox" 
              name="primaryTaxFiler" 
              id="primaryTaxFiler" 
              value={primaryState.primaryTaxFiler} 
              onClick={handlePrimaryCheckboxChange}
            />
          </div>
        </div>
        <div class="pure-g">
          <div class="pure-u-1 pure-u-md-1-3">
            <label htmlFor="relationship">Relationship</label>
            <select name="relationship" id="relationship" value={primaryState.relationship} onChange={handlePrimaryChange} >
              <option value="parent">Parent</option>
              <option value="spouse">Spouse</option>
              <option value="son">Son</option>
              <option value="daughter">Daughter</option>
            </select>
          </div>
          <div class="pure-u-1 pure-u-md-1-3">
            <label htmlFor="income">Income</label>
            <input
              type="number" 
              name="income" 
              id="income" 
              value={primaryState.income} 
              onChange={handlePrimaryChange}
            />
          </div>
          <div class="pure-u-1 pure-u-md-1-3">
            <label htmlFor="taxDependent">Tax Dependent</label>
            <input 
              type="checkbox" 
              class="switch" 
              name="taxDependent" 
              id="taxDependent" 
              value={primaryState.taxDependent} 
              onClick={handlePrimaryCheckboxChange}
            />
          </div>
        </div>
        <div class="pure-g">
          <div class="pure-u-1 pure-u-md-1-3">
            <label htmlFor="pregnant">Pregnant</label>
            <input 
              type="checkbox" 
              class="switch" 
              name="pregnant" 
              id="pregnant" 
              value={primaryState.pregnant} 
              onClick={handlePrimaryCheckboxChange}
            />
          </div>
          { primaryState.pregnant && (
            <div class="pure-u-1 pure-u-md-1-3">
              <label htmlFor="pregnancyEndDate">Pregnancy End Date</label>
              <DatePicker
                name="pregnancyEndDate"
                id="pregnancyEndDate"
                selected={primaryState.pregnancyEndDate}
                onChange={(date) => handlePrimaryDatePickerChange(date, 'pregnancyEndDate')}
                peekNextMonth
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
              />
            </div>
          )}
        </div>
        { (primaryState.result || primaryState.alreadySubmitted) && (
          <fieldset class="result">
          <div class="pure-g">
            <div class="pure-u-1 pure-u-md-1-3">
              <h3>Primary Eligibility</h3>
            </div>
          </div>
          { primaryState.alreadySubmitted && (
            <div class="pure-g">
              <div class="pure-u-1 pure-u-md-1-3">
                <h3 class="button-error">Already Submitted</h3>
              </div>         
            </div>
          )}          
          <div class="pure-g">
            <div class="pure-u-1 pure-u-md-1-3">
              <label htmlFor="programName">Program Name</label>
              <input
                type="text"
                value={primaryState.result ? primaryState.result.programName : null}
                readOnly
              />
            </div>
            <div class="pure-u-1 pure-u-md-1-3">
              <label htmlFor="programName">Program Start Date</label>
              <input
                type="text"
                value={primaryState.result ? primaryState.result.startDate: null}
                readOnly
              />
            </div>
            <div class="pure-u-1 pure-u-md-1-3">
              <label htmlFor="endDate">Program End Date</label>
              <input
                type="text"
                value={primaryState.result ? primaryState.result.endDate: null}
                readOnly
              />
            </div>
          </div>
          </fieldset>
        )}
      </fieldset>
        {
          dependentState.map((val, idx) => {
            const indvId = `name-${idx}`;
            const addressId = `address-${idx}`;
            const dobId = `dob-${idx}`;
            const ssnId = `ssn-${idx}`;
            const usCitizenId = `usCitizen-${idx}`;
            const primaryTaxFilerId = `primaryTaxFiler-${idx}`;
            const incomeId = `income-${idx}`;
            const taxDependentId = `taxDependent-${idx}`;
            const pregnantId = `pregnant-${idx}`;
            const pregnancyEndDateId = `pregnancyEndDate-${idx}`;
            const relationshipId = `relationship-${idx}`;

            
            return (
              <fieldset>
                <legend>{`Dependent #${idx + 1}`}</legend>
                <div class="pure-g">
                  <div class="pure-u-1 pure-u-md-1-3">
                    <label htmlFor={indvId}>Name</label>
                    <input
                      type="text" 
                      name={indvId} 
                      data-idx={idx} 
                      id={indvId} 
                      className="name" 
                      value={dependentState[idx].name} 
                      onChange={handleDependentChange} 
                    />
                  </div>
                  <div class="pure-u-1 pure-u-md-1-3">
                    <label htmlFor={addressId}>Address</label>
                    <input
                      type="text"
                      name={addressId}
                      data-idx={idx}
                      id={addressId}
                      className="address"
                      value={dependentState[idx].address}
                      onChange={handleDependentChange} 
                    />
                  </div>
                  <div class="pure-u-1 pure-u-md-1-3">
                    <label htmlFor={dobId}>DOB</label>
                    <DatePicker
                      name={dobId}
                      id={dobId}
                      selected={dependentState[idx].dob}
                      onChange={(date) => handleDependentDatePickerChange(date, idx, 'dob')}
                      peekNextMonth
                      showMonthDropdown
                      showYearDropdown
                      dropdownMode="select"
                    />
                  </div>
                </div>
                <div class="pure-g">
                  <div class="pure-u-1 pure-u-md-1-3">  
                    <label htmlFor={ssnId}>SSN</label>
                    <input
                      type="text"
                      name={ssnId}
                      data-idx={idx}
                      id={ssnId}
                      className="ssn"
                      value={dependentState[idx].ssn}
                      onChange={handleDependentChange} 
                    />
                  </div>
                  <div class="pure-u-1 pure-u-md-1-3">
                    <label htmlFor={usCitizenId}>US Citizen</label> 
                    <input
                      type="checkbox"  
                      name={usCitizenId}
                      data-idx={idx}
                      className="usCitizen"
                      id={usCitizenId}
                      value={dependentState[idx].usCitizen} 
                      onClick={handleDependentCheckboxChange}
                    />
                  </div>
                  <div class="pure-u-1 pure-u-md-1-3">
                    <label htmlFor={primaryTaxFilerId}>Primary Tax Filer</label> 
                    <input 
                      type="checkbox" 
                      name={primaryTaxFilerId} 
                      data-idx={idx}
                      className="primaryTaxFiler"
                      id={primaryTaxFilerId} 
                      value={dependentState[idx].primaryTaxFiler} 
                      onClick={handleDependentCheckboxChange}
                    />
                  </div>
                </div>
                <div class="pure-g">
                  <div class="pure-u-1 pure-u-md-1-3">
                    <label htmlFor={relationshipId}>Relationship</label>
                    <select
                      name={relationshipId}
                      data-idx={idx}
                      className="relationship" 
                      id={relationshipId} 
                      value={dependentState[idx].relationship} 
                      onChange={handleDependentChange} >
                      <option value="parent">Parent</option>
                      <option value="spouse">Spouse</option>
                      <option value="son">Son</option>
                      <option value="daughter">Daughter</option>
                    </select>
                  </div>
                  <div class="pure-u-1 pure-u-md-1-3">
                    <label htmlFor={incomeId}>Income</label>
                    <input
                      type="number" 
                      name={incomeId}
                      data-idx={idx}
                      className="income"  
                      id={incomeId} 
                      value={dependentState[idx].income} 
                      onChange={handleDependentChange}
                    />
                  </div>
                  <div class="pure-u-1 pure-u-md-1-3">
                    <label htmlFor={taxDependentId}>Tax Dependent</label>
                    <input 
                      type="checkbox" 
                      name={taxDependentId}
                      data-idx={idx}
                      className="taxDependent" 
                      id={taxDependentId} 
                      value={dependentState[idx].taxDependent} 
                      onClick={handleDependentCheckboxChange}
                    />
                  </div>
                </div>
                <div class="pure-g">
                  <div class="pure-u-1 pure-u-md-1-3">
                    <label htmlFor={pregnantId}>Pregnant</label>
                    <input 
                      type="checkbox" 
                      name={pregnantId}
                      data-idx={idx}
                      className="pregnant" 
                      id={pregnantId} 
                      value={dependentState[idx].pregnant} 
                      onClick={handleDependentCheckboxChange}
                    />
                  </div>
                
                { dependentState[idx].pregnant && (
                  <div class="pure-u-1 pure-u-md-1-3">
                    <label htmlFor={pregnancyEndDateId}>Pregnancy End Date</label>
                    <DatePicker
                      name={pregnancyEndDateId}
                      data-idx={idx}
                      className="pregnancyEndDate"
                      id={pregnancyEndDateId}
                      selected={dependentState[idx].pregnancyEndDate}
                      onChange={(date) => handleDependentDatePickerChange(date, idx, 'pregnancyEndDate')}
                      peekNextMonth
                      showMonthDropdown
                      showYearDropdown
                      dropdownMode="select"
                    />
                  </div>
                  )
                }
                </div>
                <div class="pure-g">
                  <div class="pure-u-1 pure-u-md-1-3">
                    <span>&nbsp;</span>
                  </div>
                  <div class="pure-u-1 pure-u-md-1-3">
                    <span>&nbsp;</span>
                  </div>  
                  <div class="pure-u-1 pure-u-md-1-3">
                    <a class="pure-button my-button button-error" data-idx={idx} onClick={removeIndv}>Delete</a>
                  </div>  
                </div>
                { (dependentState[idx].result || dependentState[idx].alreadySubmitted) && (
                  <fieldset class="result">
                  <div class="pure-g">
                    <div class="pure-u-1 pure-u-md-1-3">
                      <h3>{`Dependent #${idx + 1}`} Eligibility</h3>
                    </div>
                  </div>
                  { dependentState[idx].alreadySubmitted && (
                    <div class="pure-g">
                      <div class="pure-u-1 pure-u-md-1-3">
                        <h3 class="button-error">Already Submitted</h3>
                      </div>         
                    </div>
                  )} 
                  <div class="pure-g">
                    <div class="pure-u-1 pure-u-md-1-3">
                      <label htmlFor="programName">Program Name</label>
                      <input
                        type="text"
                        value={dependentState[idx].result ? dependentState[idx].result.programName : null}
                        readOnly
                      />
                    </div>
                    <div class="pure-u-1 pure-u-md-1-3">
                      <label htmlFor="programName">Program Start Date</label>
                      <input
                        type="text"
                        value={dependentState[idx].result ? dependentState[idx].result.startDate : null}
                        readOnly
                      />
                    </div>
                    <div class="pure-u-1 pure-u-md-1-3">
                      <label htmlFor="endDate">Program End Date</label>
                      <input
                        type="text"
                        value={dependentState[idx].result ? dependentState[idx].result.endDate : null}
                        readOnly
                      />
                    </div>
                  </div>
                  </fieldset>
                )}

              </fieldset>
            );      
          })
        }
        <div class="pure-g">
          <div class="pure-u-1">
            <a class="pure-button my-button" onClick={addIndv}>Add Dependent</a>
            <a class="pure-button my-button" value="Reset Program Name" onClick={resetProgram}>Reset Program Name</a>   
            <a class="pure-button my-button" value="Reset Form" onClick={resetState}>Reset Form</a>           
            <a class="pure-button pure-button-primary my-button" onClick={handleEvaluate}>Evaluate</a>
          </div>
        </div>
        
   
    </form>
    </div>
    </div>
  );
}; 
export default EligibilityForm;