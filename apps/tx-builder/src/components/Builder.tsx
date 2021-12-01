import React, { useState, useEffect, ReactElement, useCallback } from 'react';
import {
  Button,
  Text,
  Title,
  TextField,
  GenericModal,
  Select,
  ModalFooterConfirmation,
  ButtonLink,
  Switch,
} from '@gnosis.pm/safe-react-components';
import styled from 'styled-components';
import { AbiItem } from 'web3-utils';

import { ContractInterface } from '../hooks/useServices/interfaceRepository';
import useServices from '../hooks/useServices';
import { ProposedTransaction } from '../typings/models';
import { ModalBody } from './ModalBody';
import { Examples } from './Examples';
import { parseInputValue, getInputHelper } from '../utils';

const ButtonContainer = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 15px;
`;

const StyledTextField = styled(TextField)`
  && {
    width: 520px;
    margin-bottom: 10px;
  }
`;

const StyledTextAreaField = (props: any) => {
  return <StyledTextField {...props} multiline rows={4} />;
};

const StyledSelect = styled(Select)`
  width: 520px;
`;

const StyledExamples = styled.div`
  button {
    padding: 0;
  }
`;

type Props = {
  contract: ContractInterface | null;
  to: string;
  chainId: number;
  nativeCurrencySymbol: string;
  transactions: ProposedTransaction[];
  onAddTransaction: (transaction: ProposedTransaction) => void;
  onRemoveTransaction: (index: number) => void;
  onSubmitTransactions: () => void;
};

export const Builder = ({
  contract,
  to,
  chainId,
  nativeCurrencySymbol,
  transactions,
  onAddTransaction,
  onRemoveTransaction,
  onSubmitTransactions,
}: Props): ReactElement | null => {
  const services = useServices(chainId);
  const [toInput, setToInput] = useState('');
  const [valueInput, setValueInput] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [selectedMethodIndex, setSelectedMethodIndex] = useState(0);
  const [showExamples, setShowExamples] = useState(false);
  const [addTxError, setAddTxError] = useState<string | undefined>();
  const [addCustomDataError, setAddCustomDataError] = useState<string | undefined>();
  const [valueError, setValueError] = useState<string | undefined>();
  const [inputCache, setInputCache] = useState<string[]>([]);
  const [isShowCustomDataChecked, setIsShowCustomDataChecked] = useState<boolean>(false);
  const [customDataValue, setCustomDataValue] = useState<string>();
  const [isValueInputVisible, setIsValueInputVisible] = useState(false);

  const handleMethod = async (methodIndex: number) => {
    if (!contract || contract.methods.length <= methodIndex) return;
    setSelectedMethodIndex(methodIndex);
  };

  const handleInput = async (inputIndex: number, input: string) => {
    inputCache[inputIndex] = input;
    setInputCache(inputCache.slice());
  };

  const getContractMethod = useCallback(() => contract?.methods[selectedMethodIndex], [contract, selectedMethodIndex]);

  const handleSubmit = () => {
    onSubmitTransactions();
    setReviewing(false);
  };

  const handleDismiss = () => {
    setReviewing(false);
  };

  const getData = useCallback(() => {
    const web3 = services.web3;

    if (!web3 || !contract?.methods) {
      return;
    }

    const method = contract.methods[selectedMethodIndex];

    if (!['receive', 'fallback'].includes(method.name)) {
      const parsedInputs: any[] = [];
      const inputDescription: string[] = [];

      method.inputs.forEach((input, index) => {
        const cleanValue = inputCache[index] || '';
        parsedInputs[index] = parseInputValue(input, cleanValue);
        inputDescription[index] = `${input.name || input.type}: ${cleanValue}`;
      });
      try {
        return web3.eth.abi.encodeFunctionCall(method as AbiItem, parsedInputs as any[]);
      } catch (error) {
        throw error;
      }
    }
  }, [contract, inputCache, selectedMethodIndex, services.web3]);

  const addTransaction = async () => {
    let description = '';
    let data: string | undefined = '';
    const web3 = services.web3;

    if (!web3) {
      return;
    }

    if (isShowCustomDataChecked) {
      if (customDataValue && services.web3 && !services.web3.utils.isHexStrict(customDataValue as string | number)) {
        setAddCustomDataError('Has to be a valid strict hex data (it must start with 0x)');
        return;
      }

      data = customDataValue;
      description = 'Custom transaction data';
    } else if (contract && contract.methods.length > selectedMethodIndex) {
      try {
        data = getData();
      } catch (error) {
        setAddTxError((error as Error).message);
        return;
      }
    }

    try {
      const cleanTo = web3.utils.toChecksumAddress(toInput);
      const cleanValue = web3.utils.toWei(valueInput || '0');

      if (data?.length === 0) {
        data = '0x';
        description = `Transfer ${web3.utils.fromWei(cleanValue.toString())} ${nativeCurrencySymbol} to ${cleanTo}`;
      }

      onAddTransaction({
        description,
        raw: { to: cleanTo, value: cleanValue, data },
      });

      setInputCache([]);
      setSelectedMethodIndex(0);
      setValueInput('');
      setCustomDataValue('');
    } catch (e) {
      setAddTxError('There was an error trying to add the transaction.');
      console.error(e);
    }
  };

  const deleteTransaction = (inputIndex: number) => {
    onRemoveTransaction(inputIndex);
  };

  const isValidAddress = useCallback(
    (address: string | null) => {
      if (!address) {
        return false;
      }
      return services?.web3?.utils.isAddress(address);
    },
    [services.web3],
  );

  const onValueInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValueError(undefined);
    const value = Number(e.target.value);
    if (isNaN(value) || value < 0) {
      setValueError(`${nativeCurrencySymbol} value`);
    }
    setValueInput(e.target.value);
  };

  // Set toInput when to changes
  useEffect(() => {
    const value = isValidAddress(to) ? (to as string) : '';
    setToInput(value);
  }, [to, isValidAddress]);

  // set when inputValue is visible
  useEffect(() => {
    const isVisible = async () => {
      if (contract) {
        const method = getContractMethod();
        setIsValueInputVisible(method?.payable || false);
      } else {
        setIsValueInputVisible(true);
      }
    };

    isVisible();
  }, [getContractMethod, contract, services, toInput]);

  useEffect(() => {
    if (transactions.length === 0) {
      setReviewing(false);
    }
  }, [transactions]);

  useEffect(() => {
    if (isShowCustomDataChecked) {
      setCustomDataValue('');
      try {
        const data = getData();
        if (data && services.web3 && !services.web3.utils.isHexStrict(data as string | number)) {
          setAddCustomDataError('Has to be a valid strict hex data (it must start with 0x)');
        }
        setCustomDataValue(data);
      } catch (error) {
        return;
      }
    }
  }, [isShowCustomDataChecked, getData, services.web3]);

  if (!contract && !isValueInputVisible) {
    return null;
  }

  return (
    <>
      <Title size="xs">Transaction information</Title>
      {contract && !contract?.methods.length && <Text size="lg">Contract ABI doesn't have any public methods.</Text>}
      {to.length > 0 && (
        <StyledTextField
          style={{ marginTop: 10 }}
          value={toInput}
          label="To Address"
          onChange={(e) => setToInput(e.target.value)}
        />
      )}
      {/* ValueInput */}
      {isValueInputVisible && (
        <StyledTextField
          style={{ marginTop: 10, marginBottom: 10 }}
          value={valueInput}
          label={`${nativeCurrencySymbol} value`}
          meta={{ error: valueError ?? undefined }}
          onChange={onValueInputChange}
        />
      )}

      {/* Contract Inputs */}
      {!isShowCustomDataChecked && contract?.methods.length && (
        <>
          <StyledSelect
            items={contract.methods.map((method, index) => ({
              id: index.toString(),
              label: method.name,
            }))}
            activeItemId={selectedMethodIndex.toString()}
            onItemClick={(id: string) => {
              setAddTxError(undefined);
              handleMethod(Number(id));
            }}
          />
          <StyledExamples>
            <ButtonLink color="primary" onClick={() => setShowExamples((prev) => !prev)}>
              {showExamples ? 'Hide Examples' : 'Show Examples'}
            </ButtonLink>

            {showExamples && <Examples />}
          </StyledExamples>

          {getContractMethod()?.inputs.map((input, index) => {
            return (
              <div key={index}>
                <StyledTextField
                  style={{ marginTop: 10 }}
                  value={inputCache[index] || ''}
                  label={`${input.name || ''}(${getInputHelper(input)})`}
                  onChange={(e) => {
                    setAddTxError(undefined);
                    handleInput(index, e.target.value);
                  }}
                />
                <br />
              </div>
            );
          })}
          {addTxError && (
            <Text size="lg" color="error">
              {addTxError}
            </Text>
          )}
        </>
      )}

      {/* hex encoded switcher*/}
      {isShowCustomDataChecked && (
        <>
          <StyledTextAreaField
            label="Data (hex encoded)*"
            value={customDataValue}
            onChange={(e: any) => setCustomDataValue(e.target.value)}
          />
          {addCustomDataError && (
            <Text size="lg" color="error">
              {addCustomDataError}
            </Text>
          )}
        </>
      )}

      <Text size="lg">
        <Switch checked={isShowCustomDataChecked} onChange={setIsShowCustomDataChecked} />
        Use custom data (hex encoded)
      </Text>

      {/* Actions */}
      <ButtonContainer>
        <Button
          size="md"
          color="primary"
          disabled={!isValidAddress(toInput) && !contract?.methods.length}
          onClick={() => addTransaction()}
        >
          Add transaction
        </Button>

        <Button
          size="md"
          disabled={!transactions.length}
          variant="contained"
          color="primary"
          onClick={() => setReviewing(true)}
        >
          {`Send Transactions ${transactions.length ? `(${transactions.length})` : ''}`}
        </Button>
      </ButtonContainer>
      {/* TXs MODAL */}
      {reviewing && transactions.length > 0 && (
        <GenericModal
          body={<ModalBody txs={transactions} deleteTx={deleteTransaction} />}
          onClose={handleDismiss}
          title="Send Transactions"
          footer={<ModalFooterConfirmation handleOk={handleSubmit} handleCancel={handleDismiss} />}
        />
      )}
    </>
  );
};
